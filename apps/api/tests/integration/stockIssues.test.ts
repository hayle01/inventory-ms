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
import { StockRequestModel } from '../../src/modules/requests/models/StockRequest.js';
import { StockIssueModel } from '../../src/modules/issues/models/StockIssue.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 5 slice 2 (Stock Issues) integration tests. Runs against the real
 * Mongo replica set + Redis (see `pnpm docker:up`).
 */

const ADMIN_PASSWORD = 'IssuesAdminPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let adminUsername: string;
let warehouseId: string;
let locationId: string;
let productId: string;
let sequenceCounter = 0;

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

async function createApprovedStockRequest(
  agent: ReturnType<typeof request.agent>,
  quantity: string,
): Promise<string> {
  const csrf1 = await fetchCsrf(agent);
  const createRes = await agent
    .post('/api/v1/stock-requests')
    .set('X-CSRF-Token', csrf1)
    .send({ warehouseId, items: [{ productId, requestedQuantity: quantity }] });
  expect(createRes.status).toBe(201);
  const id = (createRes.body as { data: { id: string } }).data.id;

  const csrf2 = await fetchCsrf(agent);
  await agent.post(`/api/v1/stock-requests/${id}/submit`).set('X-CSRF-Token', csrf2);

  const csrf3 = await fetchCsrf(agent);
  const approveRes = await agent
    .post(`/api/v1/stock-requests/${id}/approve`)
    .set('X-CSRF-Token', csrf3)
    .send({});
  expect(approveRes.status).toBe(200);

  return id;
}

async function createPickedIssue(
  agent: ReturnType<typeof request.agent>,
  stockRequestId: string,
): Promise<string> {
  const csrf1 = await fetchCsrf(agent);
  const createRes = await agent
    .post('/api/v1/issues')
    .set('X-CSRF-Token', csrf1)
    .send({ stockRequestId });
  expect(createRes.status).toBe(201);
  const id = (createRes.body as { data: { id: string } }).data.id;

  const csrf2 = await fetchCsrf(agent);
  const pickRes = await agent.post(`/api/v1/issues/${id}/pick`).set('X-CSRF-Token', csrf2);
  expect(pickRes.status).toBe(200);

  return id;
}

/** Bypasses the service to construct a `picked` issue directly against a dummy approved request, for tests that need precise control over concurrent picked quantities. */
async function seedDummyApprovedRequestId(): Promise<Types.ObjectId> {
  sequenceCounter += 1;
  const doc = await StockRequestModel.create({
    organizationId,
    requestNumber: `REQ-DUMMY-${String(sequenceCounter)}`,
    warehouseId: new Types.ObjectId(warehouseId),
    status: 'approved',
    items: [
      {
        lineNumber: 1,
        productId: new Types.ObjectId(productId),
        productName: 'Dummy',
        productSku: 'DUMMY-SKU',
        requestedQuantity: '5',
        approvedQuantity: '5',
        reservedQuantity: '0',
        fulfilledQuantity: '0',
      },
    ],
  });
  return doc._id;
}

async function seedPickedIssue(stockRequestId: Types.ObjectId, pickedQuantity: string) {
  sequenceCounter += 1;
  return StockIssueModel.create({
    organizationId,
    issueNumber: `ISS-DUMMY-${String(sequenceCounter)}`,
    stockRequestId,
    warehouseId: new Types.ObjectId(warehouseId),
    status: 'picked',
    items: [
      {
        lineNumber: 1,
        stockRequestLineNumber: 1,
        productId: new Types.ObjectId(productId),
        productName: 'Dummy',
        productSku: 'DUMMY-SKU',
        locationId: new Types.ObjectId(locationId),
        lotId: null,
        lotNumber: null,
        pickedQuantity,
        unitCost: null,
      },
    ],
    pickedBy: null,
    pickedAt: new Date(),
  });
}

describe('Stock Issues (FEFO/FIFO pick, post, reverse)', () => {
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    adminUsername = `iss-admin-${suffix}`;

    const org = await Organization.create({
      code: `iss-test-${suffix}`,
      name: 'Stock Issues Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'ISS-WH',
      name: 'Issues Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'ISS-LOC',
      name: 'Issues Shelf',
    });
    locationId = location._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'ISS-CAT',
      name: 'Issues Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'ISS-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'ISS-SKU-1',
      name: 'Issues Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const adminRole = await RoleModel.create({
      organizationId,
      name: 'IssAdminRole',
      permissionNames: [
        'stock_requests.view',
        'stock_requests.create',
        'stock_requests.update',
        'stock_requests.submit',
        'stock_requests.approve',
        'stock_requests.cancel',
        'issues.view',
        'issues.create',
        'issues.update',
        'issues.pick',
        'issues.post',
        'issues.reverse',
        'inventory.view',
      ],
      isSystem: false,
    });

    await UserModel.create({
      organizationId,
      fullName: 'Issues Admin',
      usernameNormalized: adminUsername,
      emailNormalized: `${adminUsername}@example.test`,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      status: 'active',
      roleIds: [adminRole._id],
    });

    adminAgent = await loginAgent(adminUsername, ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await StockIssueModel.deleteMany({ organizationId });
    await StockRequestModel.deleteMany({ organizationId });
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

  it('ISS-01: request -> approve -> issue -> pick -> post decrements stock and fulfills the request', async () => {
    await seedAvailableBalance('20');
    const stockRequestId = await createApprovedStockRequest(adminAgent, '5');
    const issueId = await createPickedIssue(adminAgent, stockRequestId);

    const csrf = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/issues/${issueId}/post`)
      .set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    expect((postRes.body as { data: { status: string } }).data.status).toBe('posted');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('15');
    expect(balance?.reservedQuantity.toString()).toBe('0');

    const requestRes = await adminAgent.get(`/api/v1/stock-requests/${stockRequestId}`);
    const requestBody = (
      requestRes.body as { data: { status: string; items: { fulfilledQuantity: string }[] } }
    ).data;
    expect(requestBody.status).toBe('fulfilled');
    expect(requestBody.items[0]?.fulfilledQuantity).toBe('5');
  });

  it('rejects posting without an Idempotency-Key header (400)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const stockRequestId = await createApprovedStockRequest(adminAgent, '3');
    const issueId = await createPickedIssue(adminAgent, stockRequestId);

    const csrf = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/issues/${issueId}/post`)
      .set('X-CSRF-Token', csrf)
      .send();
    expect(postRes.status).toBe(400);
  });

  it('replaying the same Idempotency-Key posts exactly one stock movement', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const stockRequestId = await createApprovedStockRequest(adminAgent, '4');
    const issueId = await createPickedIssue(adminAgent, stockRequestId);
    const idempotencyKey = randomUUID();

    const csrf1 = await fetchCsrf(adminAgent);
    const firstRes = await adminAgent
      .post(`/api/v1/issues/${issueId}/post`)
      .set('X-CSRF-Token', csrf1)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(firstRes.status).toBe(200);

    const csrf2 = await fetchCsrf(adminAgent);
    const secondRes = await adminAgent
      .post(`/api/v1/issues/${issueId}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(secondRes.status).toBe(200);

    const movements = await StockTransactionModel.find({
      organizationId,
      referenceType: 'stockIssue',
      referenceId: new Types.ObjectId(issueId),
    }).lean();
    expect(movements).toHaveLength(1);
  });

  it('rejects creating an issue for a request that is not approved (422)', async () => {
    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/stock-requests')
      .set('X-CSRF-Token', csrf1)
      .send({ warehouseId, items: [{ productId, requestedQuantity: '2' }] });
    const draftRequestId = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(adminAgent);
    const issueRes = await adminAgent
      .post('/api/v1/issues')
      .set('X-CSRF-Token', csrf2)
      .send({ stockRequestId: draftRequestId });
    expect(issueRes.status).toBe(422);
  });

  it('reversing a posted issue nets the balance back and returns the request to approved', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const stockRequestId = await createApprovedStockRequest(adminAgent, '6');
    const issueId = await createPickedIssue(adminAgent, stockRequestId);

    const csrfPost = await fetchCsrf(adminAgent);
    await adminAgent
      .post(`/api/v1/issues/${issueId}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();

    const csrfReverse = await fetchCsrf(adminAgent);
    const reverseRes = await adminAgent
      .post(`/api/v1/issues/${issueId}/reverse`)
      .set('X-CSRF-Token', csrfReverse)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'Picked the wrong product' });
    expect(reverseRes.status).toBe(200);
    const reversalBody = reverseRes.body as { data: { status: string; reversalOfId: string } };
    expect(reversalBody.data.status).toBe('posted');
    expect(reversalBody.data.reversalOfId).toBe(issueId);

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('20');

    const requestRes = await adminAgent.get(`/api/v1/stock-requests/${stockRequestId}`);
    const requestBody = (
      requestRes.body as { data: { status: string; items: { fulfilledQuantity: string }[] } }
    ).data;
    expect(requestBody.status).toBe('approved');
    expect(requestBody.items[0]?.fulfilledQuantity).toBe('0');
  });

  it('cancelling a draft issue does not move stock', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const stockRequestId = await createApprovedStockRequest(adminAgent, '2');

    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/issues')
      .set('X-CSRF-Token', csrf1)
      .send({ stockRequestId });
    const issueId = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(adminAgent);
    const cancelRes = await adminAgent
      .post(`/api/v1/issues/${issueId}/cancel`)
      .set('X-CSRF-Token', csrf2)
      .send({ reason: 'No longer needed' });
    expect(cancelRes.status).toBe(200);
    expect((cancelRes.body as { data: { status: string } }).data.status).toBe('cancelled');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('20');
  });

  it('MI-10: concurrent issue postings cannot exceed available stock', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('8');

    const requestA = await seedDummyApprovedRequestId();
    const requestB = await seedDummyApprovedRequestId();
    const issueA = await seedPickedIssue(requestA, '5');
    const issueB = await seedPickedIssue(requestB, '5');

    const [csrfA, csrfB] = await Promise.all([fetchCsrf(adminAgent), fetchCsrf(adminAgent)]);

    const [resA, resB] = await Promise.all([
      adminAgent
        .post(`/api/v1/issues/${issueA._id.toString()}/post`)
        .set('X-CSRF-Token', csrfA)
        .set('Idempotency-Key', randomUUID())
        .send(),
      adminAgent
        .post(`/api/v1/issues/${issueB._id.toString()}/post`)
        .set('X-CSRF-Token', csrfB)
        .set('Idempotency-Key', randomUUID())
        .send(),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 422]);

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    expect(balance?.onHandQuantity.toString()).toBe('3');
    expect(Number(balance?.onHandQuantity.toString())).toBeGreaterThanOrEqual(0);
  });
});
