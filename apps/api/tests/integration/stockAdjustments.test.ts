import 'dotenv/config';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectMongo, disconnectMongo } from '../../src/shared/infrastructure/mongo.js';
import { disconnectRedis } from '../../src/shared/infrastructure/redis.js';
import { Organization } from '../../src/modules/organization/models/Organization.js';
import { WarehouseModel } from '../../src/modules/organization/models/Warehouse.js';
import { StorageLocationModel } from '../../src/modules/organization/models/StorageLocation.js';
import { CategoryModel } from '../../src/modules/catalog/models/Category.js';
import { UnitModel } from '../../src/modules/catalog/models/Unit.js';
import { ProductModel } from '../../src/modules/catalog/models/Product.js';
import { StockAdjustmentModel } from '../../src/modules/adjustments/models/StockAdjustment.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 6 slice 1 (Stock Adjustments) integration tests. Runs against the
 * real Mongo replica set + Redis (see `pnpm docker:up`).
 */

const CLERK_PASSWORD = 'AdjClerkPassw0rd!';
const MANAGER_PASSWORD = 'AdjManagerPassw0rd!';
const NO_PERM_PASSWORD = 'AdjNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let clerkUsername: string;
let managerUsername: string;
let noPermUsername: string;
let warehouseId: string;
let locationId: string;
let productId: string;

async function fetchCsrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const res = await agent.get('/api/v1/auth/csrf-token');
  return (res.body as { data: { csrfToken: string } }).data.csrfToken;
}

async function loginAgent(
  username: string,
  password: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const csrfToken = await fetchCsrf(agent);
  await agent
    .post('/api/v1/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ usernameOrEmail: username, password });
  return agent;
}

async function seedAvailableBalance(quantity: string): Promise<void> {
  await StockBalanceModel.create({
    organizationId,
    warehouseId: new Types.ObjectId(warehouseId),
    locationId: new Types.ObjectId(locationId),
    productId: new Types.ObjectId(productId),
    lotId: null,
    stockState: 'available',
    onHandQuantity: quantity,
    reservedQuantity: '0',
  });
}

function draftAdjustmentPayload(overrides: Record<string, unknown> = {}) {
  return {
    warehouseId,
    reasonCode: 'count_correction',
    items: [{ productId, locationId, stockState: 'available', quantityDelta: '5' }],
    ...overrides,
  };
}

async function createSubmittedAdjustment(
  agent: ReturnType<typeof request.agent>,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; adjustmentNumber: string }> {
  const csrf1 = await fetchCsrf(agent);
  const createRes = await agent
    .post('/api/v1/stock-adjustments')
    .set('X-CSRF-Token', csrf1)
    .send(draftAdjustmentPayload(overrides));
  expect(createRes.status).toBe(201);
  const { id, adjustmentNumber } = (
    createRes.body as { data: { id: string; adjustmentNumber: string } }
  ).data;

  const csrf2 = await fetchCsrf(agent);
  const submitRes = await agent
    .post(`/api/v1/stock-adjustments/${id}/submit`)
    .set('X-CSRF-Token', csrf2);
  expect(submitRes.status).toBe(200);

  return { id, adjustmentNumber };
}

describe('Stock Adjustments (draft, submit, approve, reject, post, reverse)', () => {
  let clerkAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    clerkUsername = `adj-clerk-${suffix}`;
    managerUsername = `adj-mgr-${suffix}`;
    noPermUsername = `adj-noperm-${suffix}`;

    const org = await Organization.create({
      code: `adj-test-${suffix}`,
      name: 'Adjustments Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'ADJ-WH',
      name: 'Adjustments Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'ADJ-LOC',
      name: 'Adjustments Shelf',
    });
    locationId = location._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'ADJ-CAT',
      name: 'Adjustments Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'ADJ-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'ADJ-SKU-1',
      name: 'Adjustments Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const clerkRole = await RoleModel.create({
      organizationId,
      name: 'AdjClerkRole',
      permissionNames: [
        'adjustments.view',
        'adjustments.create',
        'adjustments.submit',
        'inventory.view',
      ],
      isSystem: false,
    });
    const managerRole = await RoleModel.create({
      organizationId,
      name: 'AdjManagerRole',
      permissionNames: [
        'adjustments.view',
        'adjustments.approve',
        'adjustments.reject',
        'adjustments.post',
        'adjustments.reverse',
        'inventory.view',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'AdjNoPermRole',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Adjustments Clerk',
        usernameNormalized: clerkUsername,
        emailNormalized: `${clerkUsername}@example.test`,
        passwordHash: await hashPassword(CLERK_PASSWORD),
        status: 'active',
        roleIds: [clerkRole._id],
      },
      {
        organizationId,
        fullName: 'Adjustments Manager',
        usernameNormalized: managerUsername,
        emailNormalized: `${managerUsername}@example.test`,
        passwordHash: await hashPassword(MANAGER_PASSWORD),
        status: 'active',
        roleIds: [managerRole._id],
      },
      {
        organizationId,
        fullName: 'Adjustments No Perm',
        usernameNormalized: noPermUsername,
        emailNormalized: `${noPermUsername}@example.test`,
        passwordHash: await hashPassword(NO_PERM_PASSWORD),
        status: 'active',
        roleIds: [noPermRole._id],
      },
    ]);

    clerkAgent = await loginAgent(clerkUsername, CLERK_PASSWORD);
    managerAgent = await loginAgent(managerUsername, MANAGER_PASSWORD);
  });

  afterAll(async () => {
    await StockAdjustmentModel.deleteMany({ organizationId });
    await StockTransactionModel.deleteMany({ organizationId });
    await StockBalanceModel.deleteMany({ organizationId });
    await ProductModel.deleteMany({ organizationId });
    await CategoryModel.deleteMany({ organizationId });
    await UnitModel.deleteMany({ organizationId });
    await StorageLocationModel.deleteMany({ organizationId });
    await WarehouseModel.deleteMany({ organizationId });
    await RoleModel.deleteMany({ organizationId });
    await UserModel.deleteMany({ organizationId });
    await Organization.deleteMany({ _id: organizationId });
    await AuditEventModel.deleteMany({ organizationId });
    await disconnectMongo();
    await disconnectRedis();
  });

  it('ADJ-01: a positive adjustment increases the balance once approved and posted', async () => {
    const { id, adjustmentNumber } = await createSubmittedAdjustment(clerkAgent);
    expect(adjustmentNumber).toMatch(/^ADJ-\d{6}$/);

    const csrfApprove = await fetchCsrf(managerAgent);
    const approveRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/approve`)
      .set('X-CSRF-Token', csrfApprove);
    expect(approveRes.status).toBe(200);

    const csrfPost = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    const posted = (
      postRes.body as {
        data: { status: string; items: { priorQuantity: string; resultingQuantity: string }[] };
      }
    ).data;
    expect(posted.status).toBe('posted');
    expect(posted.items[0]?.priorQuantity).toBe('0');
    expect(posted.items[0]?.resultingQuantity).toBe('5');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('5');
  });

  it('ADJ-02: posting is denied for an unapproved (submitted-only) adjustment', async () => {
    const { id } = await createSubmittedAdjustment(clerkAgent);

    const csrf = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/post`)
      .set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(422);
  });

  it('rejects a negative adjustment that would drive stock below zero (422)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('3');

    const { id } = await createSubmittedAdjustment(clerkAgent, {
      items: [{ productId, locationId, stockState: 'available', quantityDelta: '-10' }],
    });
    const csrfApprove = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/approve`)
      .set('X-CSRF-Token', csrfApprove);

    const csrfPost = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(422);

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('3');
  });

  it('denies self-approval for the clerk who created the adjustment (403)', async () => {
    const { id } = await createSubmittedAdjustment(clerkAgent);

    const csrf = await fetchCsrf(clerkAgent);
    const approveRes = await clerkAgent
      .post(`/api/v1/stock-adjustments/${id}/approve`)
      .set('X-CSRF-Token', csrf);
    expect(approveRes.status).toBe(403);
  });

  it('rejecting a submitted adjustment records the reason and blocks posting', async () => {
    const { id } = await createSubmittedAdjustment(clerkAgent);

    const csrf = await fetchCsrf(managerAgent);
    const rejectRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/reject`)
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Evidence insufficient' });
    expect(rejectRes.status).toBe(200);
    expect((rejectRes.body as { data: { status: string } }).data.status).toBe('rejected');

    const csrfPost = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(422);
  });

  it('reversing a posted adjustment nets the balance back to its prior value', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('10');

    const { id } = await createSubmittedAdjustment(clerkAgent, {
      items: [{ productId, locationId, stockState: 'available', quantityDelta: '4' }],
    });
    const csrfApprove = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/approve`)
      .set('X-CSRF-Token', csrfApprove);
    const csrfPost = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();

    const csrfReverse = await fetchCsrf(managerAgent);
    const reverseRes = await managerAgent
      .post(`/api/v1/stock-adjustments/${id}/reverse`)
      .set('X-CSRF-Token', csrfReverse)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'Miscounted' });
    expect(reverseRes.status).toBe(200);
    expect(
      (reverseRes.body as { data: { status: string; reversalOfId: string } }).data.reversalOfId,
    ).toBe(id);

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('10');
  });

  it('flags requiresElevatedApproval when the adjustment magnitude crosses the material threshold', async () => {
    const csrf = await fetchCsrf(clerkAgent);
    const belowRes = await clerkAgent
      .post('/api/v1/stock-adjustments')
      .set('X-CSRF-Token', csrf)
      .send(draftAdjustmentPayload({ items: [{ productId, locationId, quantityDelta: '5' }] }));
    expect((belowRes.body as { data: { requiresElevatedApproval: boolean } }).data.requiresElevatedApproval).toBe(
      false,
    );

    const csrf2 = await fetchCsrf(clerkAgent);
    const aboveRes = await clerkAgent
      .post('/api/v1/stock-adjustments')
      .set('X-CSRF-Token', csrf2)
      .send(draftAdjustmentPayload({ items: [{ productId, locationId, quantityDelta: '150' }] }));
    expect(
      (aboveRes.body as { data: { requiresElevatedApproval: boolean } }).data.requiresElevatedApproval,
    ).toBe(true);
  });

  it('denies creating an adjustment for a user without adjustments.create (403)', async () => {
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrf = await fetchCsrf(noPermAgent);
    const createRes = await noPermAgent
      .post('/api/v1/stock-adjustments')
      .set('X-CSRF-Token', csrf)
      .send(draftAdjustmentPayload());
    expect(createRes.status).toBe(403);
  });
});
