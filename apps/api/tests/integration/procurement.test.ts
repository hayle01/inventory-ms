import 'dotenv/config';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectMongo, disconnectMongo } from '../../src/shared/infrastructure/mongo.js';
import { disconnectRedis } from '../../src/shared/infrastructure/redis.js';
import { Organization } from '../../src/modules/organization/models/Organization.js';
import { WarehouseModel } from '../../src/modules/organization/models/Warehouse.js';
import { CategoryModel } from '../../src/modules/catalog/models/Category.js';
import { UnitModel } from '../../src/modules/catalog/models/Unit.js';
import { ProductModel } from '../../src/modules/catalog/models/Product.js';
import { SupplierModel } from '../../src/modules/suppliers/models/Supplier.js';
import { PurchaseOrderModel } from '../../src/modules/procurement/models/PurchaseOrder.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 3 (Suppliers and Procurement) integration tests. Runs against the
 * real Mongo replica set + Redis (see `pnpm docker:up`).
 */

const ADMIN_PASSWORD = 'ProcurementAdminPassw0rd!';
const APPROVER_PASSWORD = 'ProcurementApproverPassw0rd!';
const NO_PERM_PASSWORD = 'ProcurementNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let adminUsername: string;
let approverUsername: string;
let noPermUsername: string;
let supplierId: string;
let warehouseId: string;
let productId: string;

/**
 * Always fetch the CSRF token as its own awaited step *before* building the
 * next request. Interleaving `await fetchCsrf(agent)` inside a `.post(...)
 * .set(...)` chain on the same agent is a trap: supertest snapshots the
 * agent's cookie jar when the request object is created, so a token fetched
 * mid-chain lands in the jar *after* that snapshot and no longer matches --
 * a stale/mismatched-looking 403 that has nothing to do with the server.
 */
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

describe('Suppliers and Procurement', () => {
  let adminAgent: ReturnType<typeof request.agent>;
  let approverAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    adminUsername = `proc-admin-${suffix}`;
    approverUsername = `proc-approver-${suffix}`;
    noPermUsername = `proc-noperm-${suffix}`;

    const org = await Organization.create({
      code: `proc-test-${suffix}`,
      name: 'Procurement Test Org',
    });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'PROC-WH',
      name: 'Procurement Warehouse',
    });
    warehouseId = warehouse._id.toString();

    const category = await CategoryModel.create({
      organizationId,
      code: 'PROC-CAT',
      name: 'Procurement Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'PROC-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'PROC-SKU-1',
      name: 'Procurement Test Product',
      purchasePrice: '1.0000',
      reorderLevel: '0',
    });
    productId = product._id.toString();

    const supplier = await SupplierModel.create({
      organizationId,
      code: 'PROC-SUP',
      name: 'Test Supplier',
    });
    supplierId = supplier._id.toString();

    const fullPermsRole = await RoleModel.create({
      organizationId,
      name: 'ProcFullPerms',
      permissionNames: [
        'suppliers.view',
        'suppliers.manage',
        'purchase_orders.view',
        'purchase_orders.create',
        'purchase_orders.update',
        'purchase_orders.submit',
        'purchase_orders.approve',
        'purchase_orders.reject',
        'purchase_orders.cancel',
      ],
      isSystem: false,
    });
    const approverOnlyRole = await RoleModel.create({
      organizationId,
      name: 'ProcApproverOnly',
      permissionNames: [
        'purchase_orders.view',
        'purchase_orders.approve',
        'purchase_orders.reject',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'ProcNoPerm',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Procurement Admin',
        usernameNormalized: adminUsername,
        emailNormalized: `${adminUsername}@example.test`,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        status: 'active',
        roleIds: [fullPermsRole._id],
      },
      {
        organizationId,
        fullName: 'Procurement Approver',
        usernameNormalized: approverUsername,
        emailNormalized: `${approverUsername}@example.test`,
        passwordHash: await hashPassword(APPROVER_PASSWORD),
        status: 'active',
        roleIds: [approverOnlyRole._id],
      },
      {
        organizationId,
        fullName: 'Procurement No Perm',
        usernameNormalized: noPermUsername,
        emailNormalized: `${noPermUsername}@example.test`,
        passwordHash: await hashPassword(NO_PERM_PASSWORD),
        status: 'active',
        roleIds: [noPermRole._id],
      },
    ]);

    adminAgent = await loginAgent(adminUsername, ADMIN_PASSWORD);
    approverAgent = await loginAgent(approverUsername, APPROVER_PASSWORD);
  });

  afterAll(async () => {
    await PurchaseOrderModel.deleteMany({ organizationId });
    await SupplierModel.deleteMany({ organizationId });
    await ProductModel.deleteMany({ organizationId });
    await CategoryModel.deleteMany({ organizationId });
    await UnitModel.deleteMany({ organizationId });
    await WarehouseModel.deleteMany({ organizationId });
    await RoleModel.deleteMany({ organizationId });
    await UserModel.deleteMany({ organizationId });
    await Organization.deleteMany({ _id: organizationId });
    await AuditEventModel.deleteMany({ organizationId });
    await disconnectMongo();
    await disconnectRedis();
  });

  it('creates a supplier and rejects a duplicate code (409)', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/suppliers')
      .set('X-CSRF-Token', csrfToken1)
      .send({ code: 'DUPSUP', name: 'Dup Supplier' });
    expect(createRes.status).toBe(201);

    const csrfToken2 = await fetchCsrf(adminAgent);
    const dupRes = await adminAgent
      .post('/api/v1/suppliers')
      .set('X-CSRF-Token', csrfToken2)
      .send({ code: 'DUPSUP', name: 'Dup Supplier 2' });
    expect(dupRes.status).toBe(409);
  });

  it('archives a supplier, excluding it from the list and blocking further edits', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/suppliers')
      .set('X-CSRF-Token', csrfToken1)
      .send({ code: 'TEMP-SUP', name: 'Temp Supplier' });
    const tempSupplierId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const archiveRes = await adminAgent
      .post(`/api/v1/suppliers/${tempSupplierId}/archive`)
      .set('X-CSRF-Token', csrfToken2);
    expect(archiveRes.status).toBe(200);

    const listRes = await adminAgent.get('/api/v1/suppliers');
    const suppliers = (listRes.body as { data: { id: string }[] }).data;
    expect(suppliers.some((s) => s.id === tempSupplierId)).toBe(false);

    const csrfToken3 = await fetchCsrf(adminAgent);
    const updateRes = await adminAgent
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('X-CSRF-Token', csrfToken3)
      .send({ name: 'Should not apply' });
    expect(updateRes.status).toBe(422);
  });

  it('PO-01: creates and approves a purchase order with correct decimal totals', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/purchase-orders')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        supplierId,
        warehouseId,
        items: [
          {
            productId,
            orderedQuantity: '3',
            unitCost: '2.50',
            taxAmount: '1.00',
            discountAmount: '0.50',
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const poBody = createRes.body as {
      data: { id: string; status: string; total: string; poNumber: string };
    };
    expect(poBody.data.status).toBe('draft');
    // (3 * 2.50) + 1.00 - 0.50 = 8
    expect(poBody.data.total).toBe('8');
    expect(poBody.data.poNumber).toMatch(/^PO-\d{6}$/);

    const poId = poBody.data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const submitRes = await adminAgent
      .post(`/api/v1/purchase-orders/${poId}/submit`)
      .set('X-CSRF-Token', csrfToken2);
    expect(submitRes.status).toBe(200);
    expect((submitRes.body as { data: { status: string } }).data.status).toBe('submitted');

    const csrfToken3 = await fetchCsrf(approverAgent);
    const approveRes = await approverAgent
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('X-CSRF-Token', csrfToken3);
    expect(approveRes.status).toBe(200);
    expect((approveRes.body as { data: { status: string } }).data.status).toBe('approved');
  });

  it('PO-02: denies approval for a user without purchase_orders.approve (403), no state change', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/purchase-orders')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, orderedQuantity: '1', unitCost: '1.00' }],
      });
    const poId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    await adminAgent.post(`/api/v1/purchase-orders/${poId}/submit`).set('X-CSRF-Token', csrfToken2);

    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrfToken3 = await fetchCsrf(noPermAgent);
    const deniedRes = await noPermAgent
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('X-CSRF-Token', csrfToken3);
    expect(deniedRes.status).toBe(403);

    const getRes = await adminAgent.get(`/api/v1/purchase-orders/${poId}`);
    expect((getRes.body as { data: { status: string } }).data.status).toBe('submitted');
  });

  it('prevents the creator from approving their own purchase order (separation of duty)', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/purchase-orders')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, orderedQuantity: '1', unitCost: '1.00' }],
      });
    const poId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    await adminAgent.post(`/api/v1/purchase-orders/${poId}/submit`).set('X-CSRF-Token', csrfToken2);

    const csrfToken3 = await fetchCsrf(adminAgent);
    const selfApproveRes = await adminAgent
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('X-CSRF-Token', csrfToken3);
    expect(selfApproveRes.status).toBe(403);
  });

  it('rejects an invalid status transition (approving a draft directly)', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/purchase-orders')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, orderedQuantity: '1', unitCost: '1.00' }],
      });
    const poId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(approverAgent);
    const approveRes = await approverAgent
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('X-CSRF-Token', csrfToken2);
    expect(approveRes.status).toBe(422);
  });

  it('rejects a submitted purchase order with a reason', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/purchase-orders')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, orderedQuantity: '1', unitCost: '1.00' }],
      });
    const poId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    await adminAgent.post(`/api/v1/purchase-orders/${poId}/submit`).set('X-CSRF-Token', csrfToken2);

    const csrfToken3 = await fetchCsrf(approverAgent);
    const rejectRes = await approverAgent
      .post(`/api/v1/purchase-orders/${poId}/reject`)
      .set('X-CSRF-Token', csrfToken3)
      .send({ reason: 'Pricing looks wrong' });
    expect(rejectRes.status).toBe(200);
    const body = rejectRes.body as { data: { status: string; rejectionReason: string } };
    expect(body.data.status).toBe('rejected');
    expect(body.data.rejectionReason).toBe('Pricing looks wrong');
  });

  it('cancels a draft purchase order with a reason', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/purchase-orders')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, orderedQuantity: '1', unitCost: '1.00' }],
      });
    const poId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const cancelRes = await adminAgent
      .post(`/api/v1/purchase-orders/${poId}/cancel`)
      .set('X-CSRF-Token', csrfToken2)
      .send({ reason: 'No longer needed' });
    expect(cancelRes.status).toBe(200);
    expect((cancelRes.body as { data: { status: string } }).data.status).toBe('cancelled');
  });
});
