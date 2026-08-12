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
import { StockCountModel } from '../../src/modules/counts/models/StockCount.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 6 slice 3 (Stock Counts) integration tests. Runs against the real
 * Mongo replica set + Redis (see `pnpm docker:up`).
 */

const CLERK_PASSWORD = 'CntClerkPassw0rd!';
const MANAGER_PASSWORD = 'CntManagerPassw0rd!';
const NO_PERM_PASSWORD = 'CntNoPermPassw0rd!';

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

function draftCountPayload(overrides: Record<string, unknown> = {}) {
  return {
    warehouseId,
    scope: 'cycle',
    blindCount: true,
    items: [{ productId, locationId }],
    ...overrides,
  };
}

describe('Stock Counts (snapshot, count entry, variance approval, variance posting)', () => {
  let clerkAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    clerkUsername = `cnt-clerk-${suffix}`;
    managerUsername = `cnt-mgr-${suffix}`;
    noPermUsername = `cnt-noperm-${suffix}`;

    const org = await Organization.create({
      code: `cnt-test-${suffix}`,
      name: 'Counts Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'CNT-WH',
      name: 'Counts Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'CNT-LOC',
      name: 'Counts Shelf',
    });
    locationId = location._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'CNT-CAT',
      name: 'Counts Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'CNT-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'CNT-SKU-1',
      name: 'Counts Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const clerkRole = await RoleModel.create({
      organizationId,
      name: 'CntClerkRole',
      permissionNames: [
        'stock_counts.view',
        'stock_counts.create',
        'stock_counts.submit',
        'inventory.view',
      ],
      isSystem: false,
    });
    const managerRole = await RoleModel.create({
      organizationId,
      name: 'CntManagerRole',
      permissionNames: [
        'stock_counts.view',
        'stock_counts.approve',
        'stock_counts.reject',
        'stock_counts.post',
        'stock_counts.reverse',
        'inventory.view',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'CntNoPermRole',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Counts Clerk',
        usernameNormalized: clerkUsername,
        emailNormalized: `${clerkUsername}@example.test`,
        passwordHash: await hashPassword(CLERK_PASSWORD),
        status: 'active',
        roleIds: [clerkRole._id],
      },
      {
        organizationId,
        fullName: 'Counts Manager',
        usernameNormalized: managerUsername,
        emailNormalized: `${managerUsername}@example.test`,
        passwordHash: await hashPassword(MANAGER_PASSWORD),
        status: 'active',
        roleIds: [managerRole._id],
      },
      {
        organizationId,
        fullName: 'Counts No Perm',
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
    await StockCountModel.deleteMany({ organizationId });
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

  it('CNT-01: a short count (counted < system) posts a negative variance', async () => {
    await seedAvailableBalance('10');

    const csrf1 = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-counts')
      .set('X-CSRF-Token', csrf1)
      .send(draftCountPayload());
    expect(createRes.status).toBe(201);
    const created = (
      createRes.body as { data: { id: string; countNumber: string; items: { systemQuantity: string }[] } }
    ).data;
    expect(created.countNumber).toMatch(/^CNT-\d{6}$/);
    expect(created.items[0]?.systemQuantity).toBe('10');
    const id = created.id;

    const csrf2 = await fetchCsrf(clerkAgent);
    const updateRes = await clerkAgent
      .patch(`/api/v1/stock-counts/${id}`)
      .set('X-CSRF-Token', csrf2)
      .send({ items: [{ lineNumber: 1, countedQuantity: '7' }] });
    expect(updateRes.status).toBe(200);

    const csrf3 = await fetchCsrf(clerkAgent);
    const submitRes = await clerkAgent
      .post(`/api/v1/stock-counts/${id}/submit`)
      .set('X-CSRF-Token', csrf3);
    expect(submitRes.status).toBe(200);
    expect(
      (submitRes.body as { data: { items: { varianceQuantity: string }[] } }).data.items[0]
        ?.varianceQuantity,
    ).toBe('-3');

    const csrf4 = await fetchCsrf(managerAgent);
    await managerAgent.post(`/api/v1/stock-counts/${id}/approve`).set('X-CSRF-Token', csrf4);

    const csrf5 = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-counts/${id}/post`)
      .set('X-CSRF-Token', csrf5)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    expect((postRes.body as { data: { status: string } }).data.status).toBe('posted');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('7');
  });

  it('rejects submitting a count with an uncounted line (422)', async () => {
    const csrf = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-counts')
      .set('X-CSRF-Token', csrf)
      .send(draftCountPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(clerkAgent);
    const submitRes = await clerkAgent
      .post(`/api/v1/stock-counts/${id}/submit`)
      .set('X-CSRF-Token', csrf2);
    expect(submitRes.status).toBe(422);
  });

  it('rejecting a submitted count records the reason and blocks posting', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('10');

    const csrf1 = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-counts')
      .set('X-CSRF-Token', csrf1)
      .send(draftCountPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(clerkAgent);
    await clerkAgent
      .patch(`/api/v1/stock-counts/${id}`)
      .set('X-CSRF-Token', csrf2)
      .send({ items: [{ lineNumber: 1, countedQuantity: '10' }] });
    const csrf3 = await fetchCsrf(clerkAgent);
    await clerkAgent.post(`/api/v1/stock-counts/${id}/submit`).set('X-CSRF-Token', csrf3);

    const csrf4 = await fetchCsrf(managerAgent);
    const rejectRes = await managerAgent
      .post(`/api/v1/stock-counts/${id}/reject`)
      .set('X-CSRF-Token', csrf4)
      .send({ reason: 'Recount required' });
    expect(rejectRes.status).toBe(200);

    const csrf5 = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-counts/${id}/post`)
      .set('X-CSRF-Token', csrf5)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(422);
  });

  it('denies self-approval for the clerk who created the count (403)', async () => {
    const csrf1 = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-counts')
      .set('X-CSRF-Token', csrf1)
      .send(draftCountPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;
    const csrf2 = await fetchCsrf(clerkAgent);
    await clerkAgent
      .patch(`/api/v1/stock-counts/${id}`)
      .set('X-CSRF-Token', csrf2)
      .send({ items: [{ lineNumber: 1, countedQuantity: '10' }] });
    const csrf3 = await fetchCsrf(clerkAgent);
    await clerkAgent.post(`/api/v1/stock-counts/${id}/submit`).set('X-CSRF-Token', csrf3);

    const csrf4 = await fetchCsrf(clerkAgent);
    const approveRes = await clerkAgent
      .post(`/api/v1/stock-counts/${id}/approve`)
      .set('X-CSRF-Token', csrf4);
    expect(approveRes.status).toBe(403);
  });

  it('reversing a posted count nets the balance back to its prior value', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('10');

    const csrf1 = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-counts')
      .set('X-CSRF-Token', csrf1)
      .send(draftCountPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;
    const csrf2 = await fetchCsrf(clerkAgent);
    await clerkAgent
      .patch(`/api/v1/stock-counts/${id}`)
      .set('X-CSRF-Token', csrf2)
      .send({ items: [{ lineNumber: 1, countedQuantity: '14' }] });
    const csrf3 = await fetchCsrf(clerkAgent);
    await clerkAgent.post(`/api/v1/stock-counts/${id}/submit`).set('X-CSRF-Token', csrf3);
    const csrf4 = await fetchCsrf(managerAgent);
    await managerAgent.post(`/api/v1/stock-counts/${id}/approve`).set('X-CSRF-Token', csrf4);
    const csrf5 = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-counts/${id}/post`)
      .set('X-CSRF-Token', csrf5)
      .set('Idempotency-Key', randomUUID())
      .send();

    const csrf6 = await fetchCsrf(managerAgent);
    const reverseRes = await managerAgent
      .post(`/api/v1/stock-counts/${id}/reverse`)
      .set('X-CSRF-Token', csrf6)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'Data entry error' });
    expect(reverseRes.status).toBe(200);
    expect(
      (reverseRes.body as { data: { reversalOfId: string } }).data.reversalOfId,
    ).toBe(id);

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('10');
  });

  it('denies creating a count for a user without stock_counts.create (403)', async () => {
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrf = await fetchCsrf(noPermAgent);
    const createRes = await noPermAgent
      .post('/api/v1/stock-counts')
      .set('X-CSRF-Token', csrf)
      .send(draftCountPayload());
    expect(createRes.status).toBe(403);
  });
});
