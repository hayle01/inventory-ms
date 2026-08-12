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
import { StockTransferModel } from '../../src/modules/transfers/models/StockTransfer.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 6 slice 2 (Stock Transfers) integration tests. Runs against the
 * real Mongo replica set + Redis (see `pnpm docker:up`).
 */

const CLERK_PASSWORD = 'TrfClerkPassw0rd!';
const MANAGER_PASSWORD = 'TrfManagerPassw0rd!';
const NO_PERM_PASSWORD = 'TrfNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let clerkUsername: string;
let managerUsername: string;
let noPermUsername: string;
let sourceWarehouseId: string;
let sourceLocationId: string;
let destinationWarehouseId: string;
let destinationLocationId: string;
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

async function seedSourceBalance(quantity: string): Promise<void> {
  await StockBalanceModel.create({
    organizationId,
    warehouseId: new Types.ObjectId(sourceWarehouseId),
    locationId: new Types.ObjectId(sourceLocationId),
    productId: new Types.ObjectId(productId),
    lotId: null,
    stockState: 'available',
    onHandQuantity: quantity,
    reservedQuantity: '0',
  });
}

function draftTransferPayload(overrides: Record<string, unknown> = {}) {
  return {
    sourceWarehouseId,
    destinationWarehouseId,
    inTransitPolicy: 'in_transit',
    items: [{ productId, sourceLocationId, destinationLocationId, quantity: '4' }],
    ...overrides,
  };
}

async function createApprovedTransfer(
  creatorAgent: ReturnType<typeof request.agent>,
  approverAgent: ReturnType<typeof request.agent>,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; transferNumber: string }> {
  const csrf1 = await fetchCsrf(creatorAgent);
  const createRes = await creatorAgent
    .post('/api/v1/stock-transfers')
    .set('X-CSRF-Token', csrf1)
    .send(draftTransferPayload(overrides));
  expect(createRes.status).toBe(201);
  const { id, transferNumber } = (
    createRes.body as { data: { id: string; transferNumber: string } }
  ).data;

  const csrf2 = await fetchCsrf(creatorAgent);
  const submitRes = await creatorAgent
    .post(`/api/v1/stock-transfers/${id}/submit`)
    .set('X-CSRF-Token', csrf2);
  expect(submitRes.status).toBe(200);

  const csrf3 = await fetchCsrf(approverAgent);
  const approveRes = await approverAgent
    .post(`/api/v1/stock-transfers/${id}/approve`)
    .set('X-CSRF-Token', csrf3);
  expect(approveRes.status).toBe(200);

  return { id, transferNumber };
}

describe('Stock Transfers (immediate, in-transit, receive, reverse)', () => {
  let clerkAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    clerkUsername = `trf-clerk-${suffix}`;
    managerUsername = `trf-mgr-${suffix}`;
    noPermUsername = `trf-noperm-${suffix}`;

    const org = await Organization.create({
      code: `trf-test-${suffix}`,
      name: 'Transfers Test Org',
    });
    organizationId = org._id;

    const sourceWarehouse = await WarehouseModel.create({
      organizationId,
      code: 'TRF-SRC-WH',
      name: 'Transfers Source Warehouse',
    });
    sourceWarehouseId = sourceWarehouse._id.toString();
    const sourceLocation = await StorageLocationModel.create({
      organizationId,
      warehouseId: sourceWarehouse._id,
      code: 'TRF-SRC-LOC',
      name: 'Transfers Source Shelf',
    });
    sourceLocationId = sourceLocation._id.toString();

    const destinationWarehouse = await WarehouseModel.create({
      organizationId,
      code: 'TRF-DST-WH',
      name: 'Transfers Destination Warehouse',
    });
    destinationWarehouseId = destinationWarehouse._id.toString();
    const destinationLocation = await StorageLocationModel.create({
      organizationId,
      warehouseId: destinationWarehouse._id,
      code: 'TRF-DST-LOC',
      name: 'Transfers Destination Shelf',
    });
    destinationLocationId = destinationLocation._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'TRF-CAT',
      name: 'Transfers Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'TRF-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'TRF-SKU-1',
      name: 'Transfers Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const clerkRole = await RoleModel.create({
      organizationId,
      name: 'TrfClerkRole',
      permissionNames: ['transfers.view', 'transfers.create', 'transfers.submit', 'inventory.view'],
      isSystem: false,
    });
    const managerRole = await RoleModel.create({
      organizationId,
      name: 'TrfManagerRole',
      permissionNames: [
        'transfers.view',
        'transfers.approve',
        'transfers.post',
        'transfers.reverse',
        'inventory.view',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'TrfNoPermRole',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Transfers Clerk',
        usernameNormalized: clerkUsername,
        emailNormalized: `${clerkUsername}@example.test`,
        passwordHash: await hashPassword(CLERK_PASSWORD),
        status: 'active',
        roleIds: [clerkRole._id],
      },
      {
        organizationId,
        fullName: 'Transfers Manager',
        usernameNormalized: managerUsername,
        emailNormalized: `${managerUsername}@example.test`,
        passwordHash: await hashPassword(MANAGER_PASSWORD),
        status: 'active',
        roleIds: [managerRole._id],
      },
      {
        organizationId,
        fullName: 'Transfers No Perm',
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
    await StockTransferModel.deleteMany({ organizationId });
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

  it('TRF-01: an immediate transfer moves stock from source to destination in one post', async () => {
    await seedSourceBalance('20');
    const { id, transferNumber } = await createApprovedTransfer(clerkAgent, managerAgent, {
      inTransitPolicy: 'immediate',
    });
    expect(transferNumber).toMatch(/^TRF-\d{6}$/);

    const csrf = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-transfers/${id}/post`)
      .set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    expect((postRes.body as { data: { status: string } }).data.status).toBe('completed');

    const sourceBalance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(sourceWarehouseId),
      stockState: 'available',
    }).lean();
    const destinationBalance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(destinationWarehouseId),
      stockState: 'available',
    }).lean();
    expect(sourceBalance?.onHandQuantity.toString()).toBe('16');
    expect(destinationBalance?.onHandQuantity.toString()).toBe('4');
  });

  it('TRF-02: an in-transit transfer holds stock in transit until received', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedSourceBalance('20');
    const { id } = await createApprovedTransfer(clerkAgent, managerAgent, {
      inTransitPolicy: 'in_transit',
    });

    const csrfPost = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-transfers/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    expect((postRes.body as { data: { status: string } }).data.status).toBe('in_transit');

    const sourceBalanceAfterPost = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(sourceWarehouseId),
      stockState: 'available',
    }).lean();
    const destinationInTransit = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(destinationWarehouseId),
      stockState: 'in_transit',
    }).lean();
    const destinationAvailableBeforeReceive = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(destinationWarehouseId),
      stockState: 'available',
    }).lean();
    expect(sourceBalanceAfterPost?.onHandQuantity.toString()).toBe('16');
    expect(destinationInTransit?.onHandQuantity.toString()).toBe('4');
    expect(destinationAvailableBeforeReceive).toBeNull();

    const csrfReceive = await fetchCsrf(managerAgent);
    const receiveRes = await managerAgent
      .post(`/api/v1/stock-transfers/${id}/receive`)
      .set('X-CSRF-Token', csrfReceive)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(receiveRes.status).toBe(200);
    expect((receiveRes.body as { data: { status: string } }).data.status).toBe('completed');

    const destinationInTransitAfter = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(destinationWarehouseId),
      stockState: 'in_transit',
    }).lean();
    const destinationAvailableAfter = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(destinationWarehouseId),
      stockState: 'available',
    }).lean();
    expect(destinationInTransitAfter?.onHandQuantity.toString()).toBe('0');
    expect(destinationAvailableAfter?.onHandQuantity.toString()).toBe('4');
  });

  it('rejects posting without an Idempotency-Key header (400)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedSourceBalance('20');
    const { id } = await createApprovedTransfer(clerkAgent, managerAgent);

    const csrf = await fetchCsrf(managerAgent);
    const postRes = await managerAgent
      .post(`/api/v1/stock-transfers/${id}/post`)
      .set('X-CSRF-Token', csrf)
      .send();
    expect(postRes.status).toBe(400);
  });

  it('replaying the same Idempotency-Key posts exactly one pair of stock movements per line', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedSourceBalance('20');
    const { id } = await createApprovedTransfer(clerkAgent, managerAgent, {
      inTransitPolicy: 'immediate',
    });
    const idempotencyKey = randomUUID();

    const csrf1 = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-transfers/${id}/post`)
      .set('X-CSRF-Token', csrf1)
      .set('Idempotency-Key', idempotencyKey)
      .send();

    const csrf2 = await fetchCsrf(managerAgent);
    const secondRes = await managerAgent
      .post(`/api/v1/stock-transfers/${id}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(secondRes.status).toBe(200);

    const movements = await StockTransactionModel.find({
      organizationId,
      referenceType: 'stockTransfer',
      referenceId: new Types.ObjectId(id),
    }).lean();
    expect(movements).toHaveLength(2);
  });

  it('denies self-approval for the clerk who created the transfer (403)', async () => {
    const csrf1 = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-transfers')
      .set('X-CSRF-Token', csrf1)
      .send(draftTransferPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;
    const csrf2 = await fetchCsrf(clerkAgent);
    await clerkAgent.post(`/api/v1/stock-transfers/${id}/submit`).set('X-CSRF-Token', csrf2);

    const csrf3 = await fetchCsrf(clerkAgent);
    const approveRes = await clerkAgent
      .post(`/api/v1/stock-transfers/${id}/approve`)
      .set('X-CSRF-Token', csrf3);
    expect(approveRes.status).toBe(403);
  });

  it('reversing a completed transfer sends stock back and preserves the original', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedSourceBalance('20');
    const { id } = await createApprovedTransfer(clerkAgent, managerAgent, {
      inTransitPolicy: 'immediate',
    });
    const csrfPost = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-transfers/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();

    const csrfReverse = await fetchCsrf(managerAgent);
    const reverseRes = await managerAgent
      .post(`/api/v1/stock-transfers/${id}/reverse`)
      .set('X-CSRF-Token', csrfReverse)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'Wrong destination' });
    expect(reverseRes.status).toBe(200);
    expect(
      (reverseRes.body as { data: { status: string; reversalOfId: string } }).data.reversalOfId,
    ).toBe(id);

    const originalRes = await managerAgent.get(`/api/v1/stock-transfers/${id}`);
    expect((originalRes.body as { data: { status: string } }).data.status).toBe('completed');

    const sourceBalance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(sourceWarehouseId),
      stockState: 'available',
    }).lean();
    expect(sourceBalance?.onHandQuantity.toString()).toBe('20');
  });

  it('rejects a create request whose source and destination locations are the same (422)', async () => {
    const csrf = await fetchCsrf(clerkAgent);
    const createRes = await clerkAgent
      .post('/api/v1/stock-transfers')
      .set('X-CSRF-Token', csrf)
      .send(
        draftTransferPayload({
          items: [
            {
              productId,
              sourceLocationId,
              destinationLocationId: sourceLocationId,
              quantity: '1',
            },
          ],
        }),
      );
    expect(createRes.status).toBe(422);
  });

  it('denies creating a transfer for a user without transfers.create (403)', async () => {
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrf = await fetchCsrf(noPermAgent);
    const createRes = await noPermAgent
      .post('/api/v1/stock-transfers')
      .set('X-CSRF-Token', csrf)
      .send(draftTransferPayload());
    expect(createRes.status).toBe(403);
  });
});
