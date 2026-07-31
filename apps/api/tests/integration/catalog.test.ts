import 'dotenv/config';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectMongo, disconnectMongo } from '../../src/shared/infrastructure/mongo.js';
import { disconnectRedis } from '../../src/shared/infrastructure/redis.js';
import { Organization } from '../../src/modules/organization/models/Organization.js';
import { WarehouseModel } from '../../src/modules/organization/models/Warehouse.js';
import { DepartmentModel } from '../../src/modules/organization/models/Department.js';
import { StorageLocationModel } from '../../src/modules/organization/models/StorageLocation.js';
import { CategoryModel } from '../../src/modules/catalog/models/Category.js';
import { UnitModel } from '../../src/modules/catalog/models/Unit.js';
import { ProductModel } from '../../src/modules/catalog/models/Product.js';
import { ProductBarcodeModel } from '../../src/modules/catalog/models/ProductBarcode.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 2 (Organization and Catalog) integration tests. Runs against the
 * real Mongo replica set + Redis (see `pnpm docker:up`).
 */

const ADMIN_PASSWORD = 'CatalogAdminPassw0rd!';
const NO_PERM_PASSWORD = 'CatalogNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let otherOrganizationId: Types.ObjectId;
let otherOrgWarehouseId: Types.ObjectId;
let adminUsername: string;
let noPermUsername: string;
let categoryId: string;
let unitId: string;

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

describe('Organization and Catalog', () => {
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    adminUsername = `catalog-admin-${suffix}`;
    noPermUsername = `catalog-noperm-${suffix}`;

    const org = await Organization.create({
      code: `catalog-test-${suffix}`,
      name: 'Catalog Test Org',
    });
    organizationId = org._id;
    const otherOrg = await Organization.create({
      code: `catalog-other-${suffix}`,
      name: 'Catalog Other Org',
    });
    otherOrganizationId = otherOrg._id;

    const otherWarehouse = await WarehouseModel.create({
      organizationId: otherOrganizationId,
      code: 'OTHER-WH',
      name: 'Other Org Warehouse',
    });
    otherOrgWarehouseId = otherWarehouse._id;

    const allPermsRole = await RoleModel.create({
      organizationId,
      name: 'CatalogAllPerms',
      permissionNames: [
        'departments.view',
        'departments.manage',
        'warehouses.view',
        'warehouses.manage',
        'locations.manage',
        'categories.view',
        'categories.manage',
        'units.manage',
        'products.view',
        'products.create',
        'products.update',
        'products.archive',
        'organizations.view',
        'organizations.manage',
      ],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'CatalogNoPerm',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Catalog Admin',
        usernameNormalized: adminUsername,
        emailNormalized: `${adminUsername}@example.test`,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        status: 'active',
        roleIds: [allPermsRole._id],
      },
      {
        organizationId,
        fullName: 'Catalog No Perm',
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
    await ProductBarcodeModel.deleteMany({ organizationId });
    await ProductModel.deleteMany({ organizationId });
    await CategoryModel.deleteMany({ organizationId });
    await UnitModel.deleteMany({ organizationId });
    await StorageLocationModel.deleteMany({
      organizationId: { $in: [organizationId, otherOrganizationId] },
    });
    await WarehouseModel.deleteMany({
      organizationId: { $in: [organizationId, otherOrganizationId] },
    });
    await DepartmentModel.deleteMany({ organizationId });
    await RoleModel.deleteMany({ organizationId });
    await UserModel.deleteMany({ organizationId });
    await Organization.deleteMany({ _id: { $in: [organizationId, otherOrganizationId] } });
    await AuditEventModel.deleteMany({
      organizationId: { $in: [organizationId, otherOrganizationId] },
    });
    await disconnectMongo();
    await disconnectRedis();
  });

  it('creates a department and rejects a duplicate code (409)', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/departments')
      .set('X-CSRF-Token', csrfToken1)
      .send({ code: 'PHARM', name: 'Pharmacy' });
    expect(createRes.status).toBe(201);

    const csrfToken2 = await fetchCsrf(adminAgent);
    const dupRes = await adminAgent
      .post('/api/v1/departments')
      .set('X-CSRF-Token', csrfToken2)
      .send({ code: 'PHARM', name: 'Pharmacy Duplicate' });
    expect(dupRes.status).toBe(409);
  });

  it('archives a department and excludes it from the list, blocking further edits', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/departments')
      .set('X-CSRF-Token', csrfToken1)
      .send({ code: 'TEMP-DEPT', name: 'Temporary Department' });
    const departmentId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const archiveRes = await adminAgent
      .post(`/api/v1/departments/${departmentId}/archive`)
      .set('X-CSRF-Token', csrfToken2);
    expect(archiveRes.status).toBe(200);

    const listRes = await adminAgent.get('/api/v1/departments');
    const departments = (listRes.body as { data: { id: string }[] }).data;
    expect(departments.some((d) => d.id === departmentId)).toBe(false);

    const csrfToken3 = await fetchCsrf(adminAgent);
    const updateRes = await adminAgent
      .patch(`/api/v1/departments/${departmentId}`)
      .set('X-CSRF-Token', csrfToken3)
      .send({ name: 'Should not apply' });
    expect(updateRes.status).toBe(422);
  });

  it('denies category creation for a user without categories.manage', async () => {
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const csrfToken = await fetchCsrf(noPermAgent);
    const res = await noPermAgent
      .post('/api/v1/categories')
      .set('X-CSRF-Token', csrfToken)
      .send({ code: 'DENIED', name: 'Should be denied' });
    expect(res.status).toBe(403);
  });

  it('creates a category and a unit for use by products', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const categoryRes = await adminAgent
      .post('/api/v1/categories')
      .set('X-CSRF-Token', csrfToken1)
      .send({ code: 'MEDS', name: 'Medicines' });
    expect(categoryRes.status).toBe(201);
    categoryId = (categoryRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const unitRes = await adminAgent
      .post('/api/v1/units')
      .set('X-CSRF-Token', csrfToken2)
      .send({ code: 'BOX', name: 'Box', symbol: 'box', decimalPlaces: 0 });
    expect(unitRes.status).toBe(201);
    unitId = (unitRes.body as { data: { id: string } }).data.id;
  });

  it('PROD-01: creates a product with a unique SKU and finds it via search', async () => {
    const csrfToken = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/products')
      .set('X-CSRF-Token', csrfToken)
      .send({
        categoryId,
        unitId,
        sku: 'AMOX-500',
        name: 'Amoxicillin 500mg',
        purchasePrice: '2.5000',
        reorderLevel: '10',
        trackLots: true,
        trackExpiry: true,
        barcodes: ['1234567890123'],
      });
    expect(createRes.status).toBe(201);
    const body = createRes.body as {
      data: { sku: string; purchasePrice: string; barcodes: string[] };
    };
    expect(body.data.sku).toBe('AMOX-500');
    expect(body.data.purchasePrice).toBe('2.5000');
    expect(body.data.barcodes).toEqual(['1234567890123']);

    const searchRes = await adminAgent.get('/api/v1/products/search').query({ q: 'Amoxicillin' });
    expect(searchRes.status).toBe(200);
    const searchBody = searchRes.body as { data: { sku: string }[] };
    expect(searchBody.data.some((p) => p.sku === 'AMOX-500')).toBe(true);
  });

  it('PROD-02: rejects a duplicate SKU with a validation-safe conflict', async () => {
    const csrfToken = await fetchCsrf(adminAgent);
    const res = await adminAgent.post('/api/v1/products').set('X-CSRF-Token', csrfToken).send({
      categoryId,
      unitId,
      sku: 'AMOX-500',
      name: 'Amoxicillin duplicate',
      purchasePrice: '1.0000',
    });
    expect(res.status).toBe(409);
  });

  it('rejects trackExpiry without trackLots', async () => {
    const csrfToken = await fetchCsrf(adminAgent);
    const res = await adminAgent.post('/api/v1/products').set('X-CSRF-Token', csrfToken).send({
      categoryId,
      unitId,
      sku: 'BAD-EXPIRY',
      name: 'Bad expiry config',
      purchasePrice: '1.0000',
      trackLots: false,
      trackExpiry: true,
    });
    expect(res.status).toBe(422);
  });

  it('PROD-03: archives a product, retaining it while excluding it from the active list', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const createRes = await adminAgent
      .post('/api/v1/products')
      .set('X-CSRF-Token', csrfToken1)
      .send({
        categoryId,
        unitId,
        sku: 'ARCHIVE-ME',
        name: 'To be archived',
        purchasePrice: '5.0000',
      });
    const productId = (createRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const archiveRes = await adminAgent
      .post(`/api/v1/products/${productId}/archive`)
      .set('X-CSRF-Token', csrfToken2);
    expect(archiveRes.status).toBe(200);

    const listRes = await adminAgent.get('/api/v1/products');
    const products = (listRes.body as { data: { id: string }[] }).data;
    expect(products.some((p) => p.id === productId)).toBe(false);

    const getRes = await adminAgent.get(`/api/v1/products/${productId}`);
    expect(getRes.status).toBe(200);
    expect((getRes.body as { data: { status: string } }).data.status).toBe('archived');

    const csrfToken3 = await fetchCsrf(adminAgent);
    const updateRes = await adminAgent
      .patch(`/api/v1/products/${productId}`)
      .set('X-CSRF-Token', csrfToken3)
      .send({ name: 'Should not apply' });
    expect(updateRes.status).toBe(422);
  });

  it('rejects a duplicate barcode across products', async () => {
    const csrfToken = await fetchCsrf(adminAgent);
    const res = await adminAgent
      .post('/api/v1/products')
      .set('X-CSRF-Token', csrfToken)
      .send({
        categoryId,
        unitId,
        sku: 'DUPE-BARCODE',
        name: 'Duplicate barcode product',
        purchasePrice: '1.0000',
        barcodes: ['1234567890123'],
      });
    expect(res.status).toBe(409);
  });

  it("scopes warehouses to the organization (404 for another organization's warehouse)", async () => {
    const res = await adminAgent.get(`/api/v1/warehouses/${otherOrgWarehouseId.toString()}`);
    expect(res.status).toBe(404);
  });

  it('creates a warehouse and a nested storage location, rejecting duplicate location codes', async () => {
    const csrfToken1 = await fetchCsrf(adminAgent);
    const warehouseRes = await adminAgent
      .post('/api/v1/warehouses')
      .set('X-CSRF-Token', csrfToken1)
      .send({ code: 'MAIN-WH', name: 'Main Warehouse' });
    expect(warehouseRes.status).toBe(201);
    const warehouseId = (warehouseRes.body as { data: { id: string } }).data.id;

    const csrfToken2 = await fetchCsrf(adminAgent);
    const locationRes = await adminAgent
      .post(`/api/v1/warehouses/${warehouseId}/locations`)
      .set('X-CSRF-Token', csrfToken2)
      .send({ code: 'A1', name: 'Aisle 1', locationType: 'normal' });
    expect(locationRes.status).toBe(201);

    const csrfToken3 = await fetchCsrf(adminAgent);
    const dupLocationRes = await adminAgent
      .post(`/api/v1/warehouses/${warehouseId}/locations`)
      .set('X-CSRF-Token', csrfToken3)
      .send({ code: 'A1', name: 'Duplicate aisle' });
    expect(dupLocationRes.status).toBe(409);
  });
});
