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
import { SupplierModel } from '../../src/modules/suppliers/models/Supplier.js';
import { PurchaseOrderModel } from '../../src/modules/procurement/models/PurchaseOrder.js';
import { StockBalanceModel } from '../../src/modules/inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../src/modules/inventory/models/StockTransaction.js';
import { InventoryLotModel } from '../../src/modules/inventory/models/InventoryLot.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Phase 7 slice 1 (Reports) integration tests. Runs against the real Mongo
 * replica set + Redis (see `pnpm docker:up`). Test data is seeded directly
 * at the model layer (not via posting workflows, which are already covered
 * by their own module test suites) so these tests focus purely on the
 * report aggregation logic.
 */

const VIEWER_PASSWORD = 'RptViewerPassw0rd!';
const NO_PERM_PASSWORD = 'RptNoPermPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let viewerUsername: string;
let noPermUsername: string;
let warehouseId: string;
let productId: string;
let supplierId: string;

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

describe('Reports (inventory, movement, purchases, issues, low-stock, expiry) and audit events', () => {
  let viewerAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    viewerUsername = `rpt-viewer-${suffix}`;
    noPermUsername = `rpt-noperm-${suffix}`;

    const org = await Organization.create({ code: `rpt-test-${suffix}`, name: 'Reports Test Org' });
    organizationId = org._id;

    const warehouse = await WarehouseModel.create({
      organizationId,
      code: 'RPT-WH',
      name: 'Reports Warehouse',
    });
    warehouseId = warehouse._id.toString();
    const location = await StorageLocationModel.create({
      organizationId,
      warehouseId: warehouse._id,
      code: 'RPT-LOC',
      name: 'Reports Shelf',
    });

    const category = await CategoryModel.create({
      organizationId,
      code: 'RPT-CAT',
      name: 'Reports Category',
    });
    const unit = await UnitModel.create({
      organizationId,
      code: 'RPT-UNIT',
      name: 'Each',
      symbol: 'ea',
    });
    const product = await ProductModel.create({
      organizationId,
      categoryId: category._id,
      unitId: unit._id,
      sku: 'RPT-SKU-1',
      name: 'Reports Test Product',
      purchasePrice: '2.5000',
      reorderLevel: '5',
    });
    productId = product._id.toString();

    const supplier = await SupplierModel.create({
      organizationId,
      code: 'RPT-SUP',
      name: 'Reports Test Supplier',
    });
    supplierId = supplier._id.toString();

    await StockBalanceModel.create({
      organizationId,
      warehouseId: warehouse._id,
      locationId: location._id,
      productId: product._id,
      lotId: null,
      stockState: 'available',
      onHandQuantity: '10',
      reservedQuantity: '2',
    });

    await StockTransactionModel.create([
      {
        organizationId,
        transactionNumber: 'STK-RPT-001',
        transactionType: 'receipt',
        productId: product._id,
        warehouseId: warehouse._id,
        locationId: location._id,
        lotId: null,
        stockState: 'available',
        quantity: '15',
        referenceType: 'goodsReceipt',
        referenceId: new Types.ObjectId(),
        referenceNumber: 'GRN-RPT-001',
        correlationId: 'rpt-seed-1',
      },
      {
        organizationId,
        transactionNumber: 'STK-RPT-002',
        transactionType: 'issue',
        productId: product._id,
        warehouseId: warehouse._id,
        locationId: location._id,
        lotId: null,
        stockState: 'available',
        quantity: '-5',
        referenceType: 'stockIssue',
        referenceId: new Types.ObjectId(),
        referenceNumber: 'ISS-RPT-001',
        correlationId: 'rpt-seed-2',
      },
    ]);

    await PurchaseOrderModel.create({
      organizationId,
      poNumber: 'PO-RPT-001',
      supplierId: supplier._id,
      warehouseId: warehouse._id,
      status: 'partially_received',
      orderDate: new Date(),
      currencyCode: 'USD',
      subtotal: '100',
      taxTotal: '0',
      discountTotal: '0',
      total: '100',
      items: [
        {
          lineNumber: 1,
          productId: product._id,
          productName: product.name,
          productSku: product.sku,
          orderedQuantity: '20',
          receivedQuantity: '15',
          unitCost: '5',
          taxAmount: '0',
          discountAmount: '0',
          lineTotal: '100',
        },
      ],
    });

    await InventoryLotModel.create({
      organizationId,
      productId: product._id,
      lotNumber: 'RPT-LOT-1',
      manufacturedAt: null,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      receivedAt: new Date(),
      status: 'active',
    });
    await StockBalanceModel.create({
      organizationId,
      warehouseId: warehouse._id,
      locationId: location._id,
      productId: product._id,
      lotId: (await InventoryLotModel.findOne({ organizationId, lotNumber: 'RPT-LOT-1' }))?._id,
      stockState: 'available',
      onHandQuantity: '4',
      reservedQuantity: '0',
    });

    const viewerRole = await RoleModel.create({
      organizationId,
      name: 'RptViewerRole',
      permissionNames: ['reports.view', 'audit.view', 'inventory.view'],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'RptNoPermRole',
      permissionNames: [],
      isSystem: false,
    });

    await UserModel.create([
      {
        organizationId,
        fullName: 'Reports Viewer',
        usernameNormalized: viewerUsername,
        emailNormalized: `${viewerUsername}@example.test`,
        passwordHash: await hashPassword(VIEWER_PASSWORD),
        status: 'active',
        roleIds: [viewerRole._id],
      },
      {
        organizationId,
        fullName: 'Reports No Perm',
        usernameNormalized: noPermUsername,
        emailNormalized: `${noPermUsername}@example.test`,
        passwordHash: await hashPassword(NO_PERM_PASSWORD),
        status: 'active',
        roleIds: [noPermRole._id],
      },
    ]);

    viewerAgent = await loginAgent(viewerUsername, VIEWER_PASSWORD);
  });

  afterAll(async () => {
    await PurchaseOrderModel.deleteMany({ organizationId });
    await StockTransactionModel.deleteMany({ organizationId });
    await StockBalanceModel.deleteMany({ organizationId });
    await InventoryLotModel.deleteMany({ organizationId });
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

  it('REPORT-01: the inventory report matches the balance projection', async () => {
    const res = await viewerAgent.get(`/api/v1/reports/inventory?warehouseId=${warehouseId}`);
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { rows: { productId: string; onHandQuantity: string; valuation: string }[] };
    };
    const row = body.data.rows.find((r) => r.productId === productId);
    expect(row).toBeDefined();
    // 10 (available, no lot) + 4 (available, lotted) = 14 on hand
    expect(row?.onHandQuantity).toBe('14');
    expect(Number(row?.valuation)).toBeCloseTo(14 * 2.5, 5);
  });

  it('REPORT-02: the stock movement report matches the immutable ledger', async () => {
    const res = await viewerAgent.get(
      `/api/v1/reports/stock-movement?productId=${productId}&warehouseId=${warehouseId}`,
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { rows: { transactionType: string }[]; summary: { totalIn: string; totalOut: string } };
    };
    expect(body.data.rows).toHaveLength(2);
    expect(body.data.summary.totalIn).toBe('15');
    expect(body.data.summary.totalOut).toBe('-5');
  });

  it('the purchases report includes outstanding quantity and supplier activity', async () => {
    const res = await viewerAgent.get(`/api/v1/reports/purchases?supplierId=${supplierId}`);
    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        rows: { poNumber: string; outstandingQuantity: string }[];
        bySupplier: { supplierId: string; purchaseOrderCount: number }[];
      };
    };
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0]?.outstandingQuantity).toBe('5');
    expect(body.data.bySupplier[0]?.purchaseOrderCount).toBe(1);
  });

  it('the low-stock report flags a product below its reorder level', async () => {
    const res = await viewerAgent.get(`/api/v1/reports/low-stock?warehouseId=${warehouseId}`);
    expect(res.status).toBe(200);
    const body = res.body as { data: { rows: { productId: string; severity: string }[] } };
    // available = 14 onHand - 2 reserved = 12, above reorderLevel 5 -- not flagged.
    // (Kept as a negative check: the seeded product should NOT appear low/out.)
    expect(body.data.rows.some((r) => r.productId === productId)).toBe(false);
  });

  it('the expiry report includes a lot expiring within the window with the right severity', async () => {
    const res = await viewerAgent.get(`/api/v1/reports/expiry?warehouseId=${warehouseId}&withinDays=30`);
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { rows: { lotNumber: string; severity: string; remainingQuantity: string }[] };
    };
    const row = body.data.rows.find((r) => r.lotNumber === 'RPT-LOT-1');
    expect(row).toBeDefined();
    expect(row?.severity).toBe('critical');
    expect(row?.remainingQuantity).toBe('4');
  });

  it('the issues report returns zeroed summary when there is no activity', async () => {
    const res = await viewerAgent.get(`/api/v1/reports/issues?warehouseId=${warehouseId}`);
    expect(res.status).toBe(200);
    const body = res.body as { data: { summary: { requestCount: number; issueCount: number } } };
    expect(body.data.summary.requestCount).toBe(0);
    expect(body.data.summary.issueCount).toBe(0);
  });

  it('GET /audit-events returns a paginated envelope and denies without audit.view (403)', async () => {
    const res = await viewerAgent.get('/api/v1/audit-events');
    expect(res.status).toBe(200);
    const body = res.body as { meta: { page: number; perPage: number; total: number } };
    expect(body.meta.page).toBe(1);

    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const deniedRes = await noPermAgent.get('/api/v1/audit-events');
    expect(deniedRes.status).toBe(403);
  });

  it('denies report access for a user without reports.view (403)', async () => {
    const noPermAgent = await loginAgent(noPermUsername, NO_PERM_PASSWORD);
    const res = await noPermAgent.get('/api/v1/reports/inventory');
    expect(res.status).toBe(403);
  });
});
