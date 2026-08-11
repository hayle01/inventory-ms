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
import { SupplierModel } from '../../src/modules/suppliers/models/Supplier.js';
import { GoodsReceiptModel } from '../../src/modules/receiving/models/GoodsReceipt.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 4 (Receiving vertical slice) integration tests. Runs against the
 * real Mongo replica set + Redis (see `pnpm docker:up`).
 */

const ADMIN_PASSWORD = 'ReceivingAdminPassw0rd!';
const NO_PERM_PASSWORD = 'ReceivingNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let adminUsername: string;
let noPermUsername: string;
let supplierId: string;
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

function draftReceiptPayload(overrides: Record<string, unknown> = {}) {
  return {
    supplierId,
    warehouseId,
    items: [
      {
        productId,
        destinationLocationId: locationId,
        receivedQuantity: '10',
        acceptedQuantity: '10',
        rejectedQuantity: '0',
        unitCost: '2.50',
        condition: 'good',
      },
    ],
    ...overrides,
  };
}

async function createVerifiedReceipt(
  agent: ReturnType<typeof request.agent>,
): Promise<{ id: string; receiptNumber: string }> {
  const csrf1 = await fetchCsrf(agent);
  const createRes = await agent
    .post('/api/v1/goods-receipts')
    .set('X-CSRF-Token', csrf1)
    .send(draftReceiptPayload());
  expect(createRes.status).toBe(201);
  const { id, receiptNumber } = (createRes.body as { data: { id: string; receiptNumber: string } })
    .data;

  const csrf2 = await fetchCsrf(agent);
  const verifyRes = await agent
    .post(`/api/v1/goods-receipts/${id}/verify`)
    .set('X-CSRF-Token', csrf2);
  expect(verifyRes.status).toBe(200);

  return { id, receiptNumber };
}

describe('Receiving (goods receipts, ledger, and balances)', () => {
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    adminUsername = `rcv-admin-${suffix}`;
    noPermUsername = `rcv-noperm-${suffix}`;

    const org = await Organization.create({
      code: `rcv-test-${suffix}`,
      name: 'Receiving Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'RCV-WH',
      name: 'Receiving Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'RCV-LOC',
      name: 'Receiving Dock',
    });
    locationId = location._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'RCV-CAT',
      name: 'Receiving Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'RCV-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'RCV-SKU-1',
      name: 'Receiving Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const supplier = await SupplierModel.create({
      organizationId,
      code: 'RCV-SUP',
      name: 'Receiving Test Supplier',
    });
    supplierId = supplier._id.toString();

    const fullPermsRole = await RoleModel.create({
      organizationId,
      name: 'RcvFullPerms',
      permissionNames: [
        'receipts.view',
        'receipts.create',
        'receipts.update',
        'receipts.verify',
        'receipts.post',
        'receipts.reverse',
        'inventory.view',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'RcvNoPerm',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Receiving Admin',
        usernameNormalized: adminUsername,
        emailNormalized: `${adminUsername}@example.test`,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        status: 'active',
        roleIds: [fullPermsRole._id],
      },
      {
        organizationId,
        fullName: 'Receiving No Perm',
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
    await GoodsReceiptModel.deleteMany({ organizationId });
    await StockTransactionModel.deleteMany({ organizationId });
    await StockBalanceModel.deleteMany({ organizationId });
    await SupplierModel.deleteMany({ organizationId });
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

  it('RCV-01: creates, verifies, and posts a receipt, increasing the stock balance', async () => {
    const { id, receiptNumber } = await createVerifiedReceipt(adminAgent);
    expect(receiptNumber).toMatch(/^GRN-\d{6}$/);

    const csrf = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(200);
    expect((postRes.body as { data: { status: string } }).data.status).toBe('posted');

    const balancesRes = await adminAgent.get(
      `/api/v1/inventory/balances?productId=${productId}&warehouseId=${warehouseId}`,
    );
    const balances = (
      balancesRes.body as { data: { onHandQuantity: string; availableQuantity: string }[] }
    ).data;
    expect(balances).toHaveLength(1);
    expect(balances[0]?.onHandQuantity).toBe('10');
    expect(balances[0]?.availableQuantity).toBe('10');
  });

  it('rejects posting without an Idempotency-Key header (400)', async () => {
    const { id } = await createVerifiedReceipt(adminAgent);
    const csrf = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrf)
      .send();
    expect(postRes.status).toBe(400);
  });

  it('rejects posting a draft receipt that has not been verified (422)', async () => {
    const csrf1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/goods-receipts')
      .set('X-CSRF-Token', csrf1)
      .send(draftReceiptPayload());
    const id = (createRes.body as { data: { id: string } }).data.id;

    const csrf2 = await fetchCsrf(adminAgent);
    const postRes = await adminAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(postRes.status).toBe(422);
  });

  it('replaying the same Idempotency-Key posts exactly one stock movement', async () => {
    const { id } = await createVerifiedReceipt(adminAgent);
    const idempotencyKey = randomUUID();

    const csrf1 = await fetchCsrf(adminAgent);
    const firstRes = await adminAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrf1)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(firstRes.status).toBe(200);

    const csrf2 = await fetchCsrf(adminAgent);
    const secondRes = await adminAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(secondRes.status).toBe(200);

    const movements = await StockTransactionModel.find({
      organizationId,
      referenceType: 'goodsReceipt',
      referenceId: new Types.ObjectId(id),
    }).lean();
    expect(movements).toHaveLength(1);
  });

  it('a reused Idempotency-Key against a different receipt returns a conflict (409)', async () => {
    const first = await createVerifiedReceipt(adminAgent);
    const second = await createVerifiedReceipt(adminAgent);
    const idempotencyKey = randomUUID();

    const csrf1 = await fetchCsrf(adminAgent);
    await adminAgent
      .post(`/api/v1/goods-receipts/${first.id}/post`)
      .set('X-CSRF-Token', csrf1)
      .set('Idempotency-Key', idempotencyKey)
      .send();

    const csrf2 = await fetchCsrf(adminAgent);
    const conflictRes = await adminAgent
      .post(`/api/v1/goods-receipts/${second.id}/post`)
      .set('X-CSRF-Token', csrf2)
      .set('Idempotency-Key', idempotencyKey)
      .send();
    expect(conflictRes.status).toBe(409);
  });

  it('reversing a posted receipt nets the balance back to zero and preserves the original', async () => {
    const balanceBefore = await StockBalanceModel.findOne({
      organizationId,
      productId: new Types.ObjectId(productId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).lean();
    const onHandBefore = balanceBefore ? Number(balanceBefore.onHandQuantity.toString()) : 0;

    const { id } = await createVerifiedReceipt(adminAgent);
    const csrfPost = await fetchCsrf(adminAgent);
    await adminAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrfPost)
      .set('Idempotency-Key', randomUUID())
      .send();

    const csrfReverse = await fetchCsrf(adminAgent);
    const reverseRes = await adminAgent
      .post(`/api/v1/goods-receipts/${id}/reverse`)
      .set('X-CSRF-Token', csrfReverse)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'Wrong quantity received' });
    expect(reverseRes.status).toBe(200);
    const reversalBody = reverseRes.body as { data: { status: string; reversalOfId: string } };
    expect(reversalBody.data.status).toBe('posted');
    expect(reversalBody.data.reversalOfId).toBe(id);

    const originalRes = await adminAgent.get(`/api/v1/goods-receipts/${id}`);
    const originalBody = originalRes.body as {
      data: { status: string; reversedAt: string | null };
    };
    expect(originalBody.data.status).toBe('posted');
    expect(originalBody.data.reversedAt).not.toBeNull();

    const balancesRes = await adminAgent.get(
      `/api/v1/inventory/balances?productId=${productId}&warehouseId=${warehouseId}`,
    );
    const balances = (balancesRes.body as { data: { onHandQuantity: string }[] }).data;
    // Net effect of posting then fully reversing this receipt is zero --
    // compare against the balance captured before this test's own posting,
    // since other tests in this suite share the same product/warehouse key.
    expect(Number(balances[0]?.onHandQuantity)).toBe(onHandBefore);
  });

  it('denies posting for a user without receipts.post (403), leaving the receipt verified', async () => {
    const { id } = await createVerifiedReceipt(adminAgent);
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrf = await fetchCsrf(noPermAgent);
    const deniedRes = await noPermAgent
      .post(`/api/v1/goods-receipts/${id}/post`)
      .set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', randomUUID())
      .send();
    expect(deniedRes.status).toBe(403);

    const getRes = await adminAgent.get(`/api/v1/goods-receipts/${id}`);
    expect((getRes.body as { data: { status: string } }).data.status).toBe('verified');
  });
});
