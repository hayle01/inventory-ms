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
import { StockReturnModel } from '../../src/modules/returns/models/StockReturn.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 5 slice 3 (Returns) integration tests. Runs against the real Mongo
 * replica set + Redis (see `pnpm docker:up`).
 */

const ADMIN_PASSWORD = 'ReturnsAdminPassw0rd!';
const NO_PERM_PASSWORD = 'ReturnsNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let adminUsername: string;
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

async function createPostedIssue(
  agent: ReturnType<typeof request.agent>,
  quantity: string,
): Promise<{ issueId: string; stockRequestId: string }> {
  const csrf1 = await fetchCsrf(agent);
  const createReqRes = await agent
    .post('/api/v1/stock-requests')
    .set('X-CSRF-Token', csrf1)
    .send({ warehouseId, items: [{ productId, requestedQuantity: quantity }] });
  const stockRequestId = (createReqRes.body as { data: { id: string } }).data.id;

  const csrf2 = await fetchCsrf(agent);
  await agent.post(`/api/v1/stock-requests/${stockRequestId}/submit`).set('X-CSRF-Token', csrf2);
  const csrf3 = await fetchCsrf(agent);
  await agent
    .post(`/api/v1/stock-requests/${stockRequestId}/approve`)
    .set('X-CSRF-Token', csrf3)
    .send({});

  const csrf4 = await fetchCsrf(agent);
  const createIssueRes = await agent
    .post('/api/v1/issues')
    .set('X-CSRF-Token', csrf4)
    .send({ stockRequestId });
  const issueId = (createIssueRes.body as { data: { id: string } }).data.id;

  const csrf5 = await fetchCsrf(agent);
  await agent.post(`/api/v1/issues/${issueId}/pick`).set('X-CSRF-Token', csrf5);

  const csrf6 = await fetchCsrf(agent);
  const postRes = await agent
    .post(`/api/v1/issues/${issueId}/post`)
    .set('X-CSRF-Token', csrf6)
    .set('Idempotency-Key', randomUUID())
    .send();
  expect(postRes.status).toBe(200);

  return { issueId, stockRequestId };
}

describe('Stock Returns (create, post against a posted issue)', () => {
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    adminUsername = `ret-admin-${suffix}`;
    noPermUsername = `ret-noperm-${suffix}`;

    const org = await Organization.create({
      code: `ret-test-${suffix}`,
      name: 'Stock Returns Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'RET-WH',
      name: 'Returns Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'RET-LOC',
      name: 'Returns Shelf',
    });
    locationId = location._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'RET-CAT',
      name: 'Returns Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'RET-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'RET-SKU-1',
      name: 'Returns Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const adminRole = await RoleModel.create({
      organizationId,
      name: 'RetAdminRole',
      permissionNames: [
        'stock_requests.view',
        'stock_requests.create',
        'stock_requests.update',
        'stock_requests.submit',
        'stock_requests.approve',
        'issues.view',
        'issues.create',
        'issues.pick',
        'issues.post',
        'returns.view',
        'returns.create',
        'returns.post',
        'inventory.view',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'RetNoPermRole',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Returns Admin',
        usernameNormalized: adminUsername,
        emailNormalized: `${adminUsername}@example.test`,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        status: 'active',
        roleIds: [adminRole._id],
      },
      {
        organizationId,
        fullName: 'Returns No Perm',
        usernameNormalized: noPermUsername,
        emailNormalized: `${noPermUsername}@example.test`,
        passwordHash: await hashPassword(NO_PERM_PASSWORD),
        status: 'active',
        roleIds: [noPermRole._id],
      },
    ]);

    adminAgent = await loginAgent(adminUsername, ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await StockReturnModel.deleteMany({ organizationId });
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

  it('RET-01: returns picked stock back to available and marks the issue line returned', async () => {
    await seedAvailableBalance('20');
    const { issueId } = await createPostedIssue(adminAgent, '6');

    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/returns')
      .set('X-CSRF-Token', csrf1)
      .send({
        stockIssueId: issueId,
        items: [{ stockIssueLineNumber: 1, quantity: '4', condition: 'good' }],
      });
    expect(createRes.status).toBe(201);
    const returnId = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/returns/${returnId}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    expect((postRes.body as { data: { status: string } }).data.status).toBe('posted');

    const balance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    // 20 - 6 (issued) + 4 (returned) = 18
    expect(balance?.onHandQuantity.toString()).toBe('18');

    const issueRes = await adminAgent.get(`/api/v1/issues/${issueId}`);
    const issueBody = (issueRes.body as { data: { items: { returnedQuantity: string }[] } }).data;
    expect(issueBody.items[0]?.returnedQuantity).toBe('4');
  });

  it('rejects returning more than the outstanding picked quantity (422)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const { issueId } = await createPostedIssue(adminAgent, '3');

    const csrf = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/returns')
      .set('X-CSRF-Token', csrf)
      .send({
        stockIssueId: issueId,
        items: [{ stockIssueLineNumber: 1, quantity: '5', condition: 'good' }],
      });
    expect(createRes.status).toBe(422);
  });

  it('routes a damaged-condition return to a non-available stock state', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const { issueId } = await createPostedIssue(adminAgent, '5');

    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/returns')
      .set('X-CSRF-Token', csrf1)
      .send({
        stockIssueId: issueId,
        items: [{ stockIssueLineNumber: 1, quantity: '2', condition: 'damaged' }],
      });
    const returnId = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(adminAgent);
    await adminAgent
      .post(`/api/v1/returns/${returnId}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', randomUUID())
      .send();

    const availableBalance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
      stockState: 'available',
    }).lean();
    const damagedBalance = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
      stockState: 'damaged',
    }).lean();
    // 20 - 5 issued = 15 available; the 2 damaged units land in their own balance row, not available.
    expect(availableBalance?.onHandQuantity.toString()).toBe('15');
    expect(damagedBalance?.onHandQuantity.toString()).toBe('2');
  });

  it('rejects posting without an Idempotency-Key header (400)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const { issueId } = await createPostedIssue(adminAgent, '2');

    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/returns')
      .set('X-CSRF-Token', csrf1)
      .send({
        stockIssueId: issueId,
        items: [{ stockIssueLineNumber: 1, quantity: '1', condition: 'good' }],
      });
    const returnId = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/returns/${returnId}/post`)
      .set('X-CSRF-Token', csrf2)
      .send();
    expect(postRes.status).toBe(400);
  });

  it('replaying the same Idempotency-Key posts exactly one stock movement', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const { issueId } = await createPostedIssue(adminAgent, '4');

    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/returns')
      .set('X-CSRF-Token', csrf1)
      .send({
        stockIssueId: issueId,
        items: [{ stockIssueLineNumber: 1, quantity: '2', condition: 'good' }],
      });
    const returnId = (createRes.body as { data: { id: string } }).data.id;
    const idempotencyKey = randomUUID();

    const csrf2 = await fetchCsrf(adminAgent);
    const firstRes = await adminAgent
      .post(`/api/v1/returns/${returnId}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(firstRes.status).toBe(200);

    const csrf3 = await fetchCsrf(adminAgent);
    const secondRes = await adminAgent
      .post(`/api/v1/returns/${returnId}/post`)
      .set('X-CSRF-Token', csrf3)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(secondRes.status).toBe(200);

    const movements = await StockTransactionModel.find({
      organizationId,
      referenceType: 'stockReturn',
      referenceId: new Types.ObjectId(returnId),
    }).lean();
    expect(movements).toHaveLength(1);
  });

  it('denies creating a return for a user without returns.create (403)', async () => {
    await StockBalanceModel.deleteMany({ organizationId, productId: new Types.ObjectId(productId) });
    await seedAvailableBalance('20');
    const { issueId } = await createPostedIssue(adminAgent, '2');

    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrf = await fetchCsrf(noPermAgent);
    const createRes = await noPermAgent
      .post('/api/v1/returns')
      .set('X-CSRF-Token', csrf)
      .send({
        stockIssueId: issueId,
        items: [{ stockIssueLineNumber: 1, quantity: '1', condition: 'good' }],
      });
    expect(createRes.status).toBe(403);
  });
});
