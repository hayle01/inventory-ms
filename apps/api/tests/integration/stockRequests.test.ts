import 'dotenv/config';
import request from 'supertest';
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
import { StockRequestModel } from '../../src/modules/requests/models/StockRequest.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 5 slice 1 (Stock Requests) integration tests. Runs against the real
 * Mongo replica set + Redis (see `pnpm docker:up`).
 */

const MANAGER_PASSWORD = 'ReqManagerPassw0rd!';
const REQUESTER_PASSWORD = 'ReqRequesterPassw0rd!';
const NO_PERM_PASSWORD = 'ReqNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let managerUsername: string;
let requesterUsername: string;
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

function draftRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    warehouseId,
    items: [{ productId, requestedQuantity: '5' }],
    ...overrides,
  };
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

async function createSubmittedRequest(
  agent: ReturnType<typeof request.agent>,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; requestNumber: string }> {
  const csrf1 = await fetchCsrf(agent);
  const createRes = await agent
    .post('/api/v1/stock-requests')
    .set('X-CSRF-Token', csrf1)
    .send(draftRequestPayload(overrides));
  expect(createRes.status).toBe(201);
  const { id, requestNumber } = (
    createRes.body as { data: { id: string; requestNumber: string } }
  ).data;

  const csrf2 = await fetchCsrf(agent);
  const submitRes = await agent
    .post(`/api/v1/stock-requests/${id}/submit`)
    .set('X-CSRF-Token', csrf2);
  expect(submitRes.status).toBe(200);

  return { id, requestNumber };
}

describe('Stock Requests (create, submit, approve, reject, cancel, reservation)', () => {
  let managerAgent: ReturnType<typeof request.agent>;
  let requesterAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    managerUsername = `req-mgr-${suffix}`;
    requesterUsername = `req-user-${suffix}`;
    noPermUsername = `req-noperm-${suffix}`;

    const org = await Organization.create({
      code: `req-test-${suffix}`,
      name: 'Stock Requests Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'REQ-WH',
      name: 'Requests Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'REQ-LOC',
      name: 'Requests Shelf',
    });
    locationId = location._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'REQ-CAT',
      name: 'Requests Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'REQ-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'REQ-SKU-1',
      name: 'Requests Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const managerRole = await RoleModel.create({
      organizationId,
      name: 'ReqManagerRole',
      permissionNames: [
        'stock_requests.view',
        'stock_requests.approve',
        'stock_requests.reject',
        'stock_requests.cancel',
      ],
      isSystem: false,
    });
    const requesterRole = await RoleModel.create({
      organizationId,
      name: 'ReqRequesterRole',
      permissionNames: [
        'stock_requests.view',
        'stock_requests.create',
        'stock_requests.update',
        'stock_requests.submit',
        'stock_requests.approve',
        'stock_requests.cancel',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'ReqNoPermRole',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Requests Manager',
        usernameNormalized: managerUsername,
        emailNormalized: `${managerUsername}@example.test`,
        passwordHash: await hashPassword(MANAGER_PASSWORD),
        status: 'active',
        roleIds: [managerRole._id],
      },
      {
        organizationId,
        fullName: 'Requests Requester',
        usernameNormalized: requesterUsername,
        emailNormalized: `${requesterUsername}@example.test`,
        passwordHash: await hashPassword(REQUESTER_PASSWORD),
        status: 'active',
        roleIds: [requesterRole._id],
      },
      {
        organizationId,
        fullName: 'Requests No Perm',
        usernameNormalized: noPermUsername,
        emailNormalized: `${noPermUsername}@example.test`,
        passwordHash: await hashPassword(NO_PERM_PASSWORD),
        status: 'active',
        roleIds: [noPermRole._id],
      },
    ]);

    managerAgent = await loginAgent(managerUsername, MANAGER_PASSWORD);
    requesterAgent = await loginAgent(requesterUsername, REQUESTER_PASSWORD);
  });

  afterAll(async () => {
    await StockRequestModel.deleteMany({ organizationId });
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

  it('REQ-01: creates, submits, and approves a request, reserving stock', async () => {
    await seedAvailableBalance('20');

    const { id, requestNumber } = await createSubmittedRequest(requesterAgent);
    expect(requestNumber).toMatch(/^REQ-\d{6}$/);

    const csrf = await fetchCsrf(managerAgent);
    const approveRes = await managerAgent
      .post(`/api/v1/stock-requests/${id}/approve`)
      .set('X-CSRF-Token', csrf)
      .send({});
    expect(approveRes.status).toBe(200);
    const approved = (
      approveRes.body as {
        data: { status: string; items: { approvedQuantity: string; reservedQuantity: string }[] };
      }
    ).data;
    expect(approved.status).toBe('approved');
    expect(approved.items[0]?.approvedQuantity).toBe('5');
    expect(approved.items[0]?.reservedQuantity).toBe('5');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.reservedQuantity.toString()).toBe('5');
  });

  it('rejects approving a request with insufficient available stock (422), leaving it submitted', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('2');

    const { id } = await createSubmittedRequest(requesterAgent, {
      items: [{ productId, requestedQuantity: '5' }],
    });

    const csrf = await fetchCsrf(managerAgent);
    const approveRes = await managerAgent
      .post(`/api/v1/stock-requests/${id}/approve`)
      .set('X-CSRF-Token', csrf)
      .send({});
    expect(approveRes.status).toBe(422);

    const getRes = await managerAgent.get(`/api/v1/stock-requests/${id}`);
    expect((getRes.body as { data: { status: string } }).data.status).toBe('submitted');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.reservedQuantity.toString()).toBe('0');
  });

  it('denies self-approval for the requester who created the request (403)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');

    const { id } = await createSubmittedRequest(requesterAgent);

    const csrf = await fetchCsrf(requesterAgent);
    const approveRes = await requesterAgent
      .post(`/api/v1/stock-requests/${id}/approve`)
      .set('X-CSRF-Token', csrf)
      .send({});
    expect(approveRes.status).toBe(403);
  });

  it('cancelling an approved request releases its reservation', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');

    const { id } = await createSubmittedRequest(requesterAgent);
    const csrfApprove = await fetchCsrf(managerAgent);
    await managerAgent
      .post(`/api/v1/stock-requests/${id}/approve`)
      .set('X-CSRF-Token', csrfApprove)
      .send({});

    const csrfCancel = await fetchCsrf(managerAgent);
    const cancelRes = await managerAgent
      .post(`/api/v1/stock-requests/${id}/cancel`)
      .set('X-CSRF-Token', csrfCancel)
      .send({ reason: 'No longer needed' });
    expect(cancelRes.status).toBe(200);
    expect((cancelRes.body as { data: { status: string } }).data.status).toBe('cancelled');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.reservedQuantity.toString()).toBe('0');
  });

  it('rejects approving a request that is not submitted (422)', async () => {
    const csrf1 = await fetchCsrf(requesterAgent);
    const createRes = await requesterAgent
      .post('/api/v1/stock-requests')
      .set('X-CSRF-Token', csrf1)
      .send(draftRequestPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(managerAgent);
    const approveRes = await managerAgent
      .post(`/api/v1/stock-requests/${id}/approve`)
      .set('X-CSRF-Token', csrf2)
      .send({});
    expect(approveRes.status).toBe(422);
  });

  it('denies creating a request for a user without stock_requests.create (403)', async () => {
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrf = await fetchCsrf(noPermAgent);
    const createRes = await noPermAgent
      .post('/api/v1/stock-requests')
      .set('X-CSRF-Token', csrf)
      .send(draftRequestPayload());
    expect(createRes.status).toBe(403);

    const denialEvent = await AuditEventModel.findOne({
      organizationId,
      action: 'authorization.denied',
      permissionUsed: 'stock_requests.create',
    }).lean();
    expect(denialEvent).not.toBeNull();
  });

  it('rejects a request from a validation failure (422) when a line has a non-positive quantity', async () => {
    const csrf = await fetchCsrf(requesterAgent);
    const createRes = await requesterAgent
      .post('/api/v1/stock-requests')
      .set('X-CSRF-Token', csrf)
      .send(draftRequestPayload({ items: [{ productId, requestedQuantity: '0' }] }));
    expect(createRes.status).toBe(422);
  });
});
