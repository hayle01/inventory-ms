import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';
import { decimal128ToString } from '../../catalog/domain/decimalMapping.js';
import type {
  ExpiryReportQuery,
  ExpiryReportResponse,
  ExpirySeverity,
  InventoryReportQuery,
  InventoryReportResponse,
  IssuesReportQuery,
  IssuesReportResponse,
  LowStockReportQuery,
  LowStockReportResponse,
  LowStockSeverity,
  PurchasesReportQuery,
  PurchasesReportResponse,
  StockMovementReportQuery,
  StockMovementReportResponse,
} from '@inventory-ms/contracts';
import { WarehouseModel } from '../../organization/models/Warehouse.js';
import { CategoryModel } from '../../catalog/models/Category.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { SupplierModel } from '../../suppliers/models/Supplier.js';
import { PurchaseOrderModel } from '../../procurement/models/PurchaseOrder.js';
import { StockRequestModel } from '../../requests/models/StockRequest.js';
import { StockIssueModel } from '../../issues/models/StockIssue.js';
import { StockReturnModel } from '../../returns/models/StockReturn.js';
import { StockBalanceModel } from '../../inventory/models/StockBalance.js';
import { StockTransactionModel } from '../../inventory/models/StockTransaction.js';
import { InventoryLotModel } from '../../inventory/models/InventoryLot.js';

function decStr(value: Types.Decimal128 | null | undefined): string {
  return value === null || value === undefined ? '0' : decimal128ToString(value);
}

async function nameMaps(
  organizationId: Types.ObjectId,
  options: { warehouseIds?: Types.ObjectId[]; categoryIds?: Types.ObjectId[]; supplierIds?: Types.ObjectId[] },
) {
  const [warehouses, categories, suppliers] = await Promise.all([
    WarehouseModel.find({
      organizationId,
      ...(options.warehouseIds ? { _id: { $in: options.warehouseIds } } : {}),
    }).lean(),
    options.categoryIds
      ? CategoryModel.find({ organizationId, _id: { $in: options.categoryIds } }).lean()
      : Promise.resolve([]),
    options.supplierIds
      ? SupplierModel.find({ organizationId, _id: { $in: options.supplierIds } }).lean()
      : Promise.resolve([]),
  ]);
  return {
    warehouseName: new Map(warehouses.map((w) => [w._id.toString(), w.name])),
    categoryName: new Map(categories.map((c) => [c._id.toString(), c.name])),
    supplierName: new Map(suppliers.map((s) => [s._id.toString(), s.name])),
  };
}

// -- Inventory and valuation --------------------------------------------

export async function getInventoryReport(
  organizationId: Types.ObjectId,
  query: InventoryReportQuery,
): Promise<InventoryReportResponse> {
  const balanceFilter: Record<string, unknown> = { organizationId, stockState: 'available' };
  if (query.warehouseId) balanceFilter['warehouseId'] = new Types.ObjectId(query.warehouseId);

  const balances = await StockBalanceModel.find(balanceFilter).lean();

  const grouped = new Map<
    string,
    { productId: Types.ObjectId; warehouseId: Types.ObjectId; onHand: Decimal; reserved: Decimal }
  >();
  for (const balance of balances) {
    const key = `${balance.productId.toString()}:${balance.warehouseId.toString()}`;
    const existing = grouped.get(key);
    const onHand = new Decimal(balance.onHandQuantity.toString());
    const reserved = new Decimal(balance.reservedQuantity.toString());
    if (existing) {
      existing.onHand = existing.onHand.plus(onHand);
      existing.reserved = existing.reserved.plus(reserved);
    } else {
      grouped.set(key, { productId: balance.productId, warehouseId: balance.warehouseId, onHand, reserved });
    }
  }

  const productIds = [...new Set([...grouped.values()].map((g) => g.productId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const products = await ProductModel.find({
    organizationId,
    _id: { $in: productIds },
    ...(query.categoryId ? { categoryId: new Types.ObjectId(query.categoryId) } : {}),
  }).lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const { warehouseName, categoryName } = await nameMaps(organizationId, {
    categoryIds: products.map((p) => p.categoryId),
  });

  let totalOnHand = new Decimal(0);
  let totalValuation = new Decimal(0);
  const rows = [];

  for (const group of grouped.values()) {
    const product = productById.get(group.productId.toString());
    if (!product) continue;
    if (!query.includeZero && group.onHand.isZero()) continue;

    const unitCost = new Decimal(product.purchasePrice.toString());
    const valuation = group.onHand.times(unitCost);
    totalOnHand = totalOnHand.plus(group.onHand);
    totalValuation = totalValuation.plus(valuation);

    rows.push({
      productId: product._id.toString(),
      sku: product.sku,
      name: product.name,
      categoryName: categoryName.get(product.categoryId.toString()) ?? null,
      warehouseId: group.warehouseId.toString(),
      warehouseName: warehouseName.get(group.warehouseId.toString()) ?? '—',
      onHandQuantity: group.onHand.toFixed(),
      reservedQuantity: group.reserved.toFixed(),
      availableQuantity: group.onHand.minus(group.reserved).toFixed(),
      unitCost: unitCost.toFixed(),
      valuation: valuation.toFixed(),
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      onHandQuantity: totalOnHand.toFixed(),
      valuation: totalValuation.toFixed(),
      productCount: new Set(rows.map((r) => r.productId)).size,
    },
  };
}

// -- Stock movement --------------------------------------------------------

export async function getStockMovementReport(
  organizationId: Types.ObjectId,
  query: StockMovementReportQuery,
): Promise<StockMovementReportResponse> {
  const filter: Record<string, unknown> = { organizationId };
  if (query.productId) filter['productId'] = new Types.ObjectId(query.productId);
  if (query.warehouseId) filter['warehouseId'] = new Types.ObjectId(query.warehouseId);
  if (query.transactionType) filter['transactionType'] = query.transactionType;
  if (query.dateFrom ?? query.dateTo) {
    filter['transactionAt'] = {
      ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
    };
  }

  const docs = await StockTransactionModel.find(filter)
    .sort({ transactionAt: -1 })
    .skip((query.page - 1) * query.perPage)
    .limit(query.perPage)
    .lean();

  const allMatching = await StockTransactionModel.find(filter)
    .select('quantity')
    .lean();
  let totalIn = new Decimal(0);
  let totalOut = new Decimal(0);
  for (const doc of allMatching) {
    const quantity = new Decimal(doc.quantity.toString());
    if (quantity.isPositive()) totalIn = totalIn.plus(quantity);
    else totalOut = totalOut.plus(quantity);
  }

  const productIds = [...new Set(docs.map((d) => d.productId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const products = await ProductModel.find({ organizationId, _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  return {
    rows: docs.map((doc) => {
      const product = productById.get(doc.productId.toString());
      return {
        id: doc._id.toString(),
        transactionNumber: doc.transactionNumber,
        transactionType: doc.transactionType,
        transactionAt: doc.transactionAt.toISOString(),
        productId: doc.productId.toString(),
        productName: product?.name ?? 'Unknown product',
        productSku: product?.sku ?? '—',
        warehouseId: doc.warehouseId.toString(),
        quantity: decStr(doc.quantity),
        referenceType: doc.referenceType,
        referenceNumber: doc.referenceNumber,
      };
    }),
    summary: {
      totalIn: totalIn.toFixed(),
      totalOut: totalOut.toFixed(),
      net: totalIn.plus(totalOut).toFixed(),
    },
  };
}

// -- Purchases, receipts, outstanding, and supplier activity ---------------

export async function getPurchasesReport(
  organizationId: Types.ObjectId,
  query: PurchasesReportQuery,
): Promise<PurchasesReportResponse> {
  const filter: Record<string, unknown> = { organizationId };
  if (query.supplierId) filter['supplierId'] = new Types.ObjectId(query.supplierId);
  if (query.warehouseId) filter['warehouseId'] = new Types.ObjectId(query.warehouseId);
  if (query.status) filter['status'] = query.status;
  if (query.dateFrom ?? query.dateTo) {
    filter['orderDate'] = {
      ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
    };
  }

  const purchaseOrders = await PurchaseOrderModel.find(filter).lean();
  const { supplierName } = await nameMaps(organizationId, {
    supplierIds: purchaseOrders.map((po) => po.supplierId),
  });

  const bySupplier = new Map<
    string,
    { count: number; totalValue: Decimal; totalOutstanding: Decimal }
  >();
  let totalValue = new Decimal(0);
  let totalOrderedQuantity = new Decimal(0);
  let totalReceivedQuantity = new Decimal(0);
  let totalOutstandingQuantity = new Decimal(0);

  const rows = purchaseOrders.map((po) => {
    const orderedQuantity = po.items.reduce(
      (sum, item) => sum.plus(item.orderedQuantity.toString()),
      new Decimal(0),
    );
    const receivedQuantity = po.items.reduce(
      (sum, item) => sum.plus(item.receivedQuantity.toString()),
      new Decimal(0),
    );
    const outstandingQuantity = Decimal.max(0, orderedQuantity.minus(receivedQuantity));
    const total = new Decimal(po.total.toString());

    totalValue = totalValue.plus(total);
    totalOrderedQuantity = totalOrderedQuantity.plus(orderedQuantity);
    totalReceivedQuantity = totalReceivedQuantity.plus(receivedQuantity);
    totalOutstandingQuantity = totalOutstandingQuantity.plus(outstandingQuantity);

    const supplierKey = po.supplierId.toString();
    const supplierEntry = bySupplier.get(supplierKey) ?? {
      count: 0,
      totalValue: new Decimal(0),
      totalOutstanding: new Decimal(0),
    };
    supplierEntry.count += 1;
    supplierEntry.totalValue = supplierEntry.totalValue.plus(total);
    supplierEntry.totalOutstanding = supplierEntry.totalOutstanding.plus(outstandingQuantity);
    bySupplier.set(supplierKey, supplierEntry);

    return {
      purchaseOrderId: po._id.toString(),
      poNumber: po.poNumber,
      supplierId: po.supplierId.toString(),
      supplierName: supplierName.get(supplierKey) ?? 'Unknown supplier',
      warehouseId: po.warehouseId.toString(),
      status: po.status,
      orderDate: po.orderDate ? po.orderDate.toISOString() : null,
      total: total.toFixed(),
      orderedQuantity: orderedQuantity.toFixed(),
      receivedQuantity: receivedQuantity.toFixed(),
      outstandingQuantity: outstandingQuantity.toFixed(),
    };
  });

  rows.sort((a, b) => (b.orderDate ?? '').localeCompare(a.orderDate ?? ''));

  return {
    rows,
    bySupplier: [...bySupplier.entries()]
      .map(([supplierId, entry]) => ({
        supplierId,
        supplierName: supplierName.get(supplierId) ?? 'Unknown supplier',
        purchaseOrderCount: entry.count,
        totalValue: entry.totalValue.toFixed(),
        totalOutstandingQuantity: entry.totalOutstanding.toFixed(),
      }))
      .sort((a, b) => Number(b.totalValue) - Number(a.totalValue)),
    totals: {
      totalValue: totalValue.toFixed(),
      totalOrderedQuantity: totalOrderedQuantity.toFixed(),
      totalReceivedQuantity: totalReceivedQuantity.toFixed(),
      totalOutstandingQuantity: totalOutstandingQuantity.toFixed(),
    },
  };
}

// -- Requests, issues, returns, and distribution ----------------------------

export async function getIssuesReport(
  organizationId: Types.ObjectId,
  query: IssuesReportQuery,
): Promise<IssuesReportResponse> {
  const dateFilter =
    query.dateFrom ?? query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
          },
        }
      : {};
  const warehouseFilter = query.warehouseId
    ? { warehouseId: new Types.ObjectId(query.warehouseId) }
    : {};

  const [requests, issues, returns] = await Promise.all([
    StockRequestModel.find({ organizationId, ...warehouseFilter, ...dateFilter }).lean(),
    StockIssueModel.find({ organizationId, ...warehouseFilter, ...dateFilter }).lean(),
    StockReturnModel.find({ organizationId, ...dateFilter }).lean(),
  ]);

  let requestedQuantity = new Decimal(0);
  let approvedQuantity = new Decimal(0);
  for (const request of requests) {
    for (const item of request.items) {
      requestedQuantity = requestedQuantity.plus(item.requestedQuantity.toString());
      approvedQuantity = approvedQuantity.plus(item.approvedQuantity.toString());
    }
  }

  let issuedQuantity = new Decimal(0);
  const postedIssues = issues.filter((issue) => issue.status === 'posted');
  for (const issue of postedIssues) {
    for (const item of issue.items) {
      issuedQuantity = issuedQuantity.plus(item.pickedQuantity.toString());
    }
  }

  let returnedQuantity = new Decimal(0);
  const postedReturns = returns.filter((ret) => ret.status === 'posted');
  for (const ret of postedReturns) {
    for (const item of ret.items) {
      returnedQuantity = returnedQuantity.plus(item.quantity.toString());
    }
  }

  const rows = issues
    .map((issue) => ({
      issueId: issue._id.toString(),
      issueNumber: issue.issueNumber,
      warehouseId: issue.warehouseId.toString(),
      status: issue.status,
      postedAt: issue.postedAt ? issue.postedAt.toISOString() : null,
      pickedQuantity: issue.items
        .reduce((sum, item) => sum.plus(item.pickedQuantity.toString()), new Decimal(0))
        .toFixed(),
      returnedQuantity: issue.items
        .reduce((sum, item) => sum.plus(item.returnedQuantity.toString()), new Decimal(0))
        .toFixed(),
    }))
    .sort((a, b) => b.issueNumber.localeCompare(a.issueNumber));

  return {
    summary: {
      requestCount: requests.length,
      requestedQuantity: requestedQuantity.toFixed(),
      approvedQuantity: approvedQuantity.toFixed(),
      issueCount: postedIssues.length,
      issuedQuantity: issuedQuantity.toFixed(),
      returnCount: postedReturns.length,
      returnedQuantity: returnedQuantity.toFixed(),
    },
    rows,
  };
}

// -- Low stock and out of stock ---------------------------------------------

export async function getLowStockReport(
  organizationId: Types.ObjectId,
  query: LowStockReportQuery,
): Promise<LowStockReportResponse> {
  const warehouses = await WarehouseModel.find({
    organizationId,
    status: { $ne: 'archived' },
    ...(query.warehouseId ? { _id: new Types.ObjectId(query.warehouseId) } : {}),
  }).lean();
  const products = await ProductModel.find({ organizationId, status: { $ne: 'archived' } }).lean();

  const balances = await StockBalanceModel.find({
    organizationId,
    stockState: 'available',
    ...(query.warehouseId ? { warehouseId: new Types.ObjectId(query.warehouseId) } : {}),
  }).lean();

  const balanceByKey = new Map<string, { onHand: Decimal; reserved: Decimal }>();
  for (const balance of balances) {
    const key = `${balance.productId.toString()}:${balance.warehouseId.toString()}`;
    const existing = balanceByKey.get(key);
    const onHand = new Decimal(balance.onHandQuantity.toString());
    const reserved = new Decimal(balance.reservedQuantity.toString());
    if (existing) {
      existing.onHand = existing.onHand.plus(onHand);
      existing.reserved = existing.reserved.plus(reserved);
    } else {
      balanceByKey.set(key, { onHand, reserved });
    }
  }

  const warehouseName = new Map(warehouses.map((w) => [w._id.toString(), w.name]));
  const rows: LowStockReportResponse['rows'] = [];
  let outOfStockCount = 0;
  let lowStockCount = 0;

  for (const product of products) {
    const reorderLevel = new Decimal(product.reorderLevel.toString());
    for (const warehouse of warehouses) {
      const key = `${product._id.toString()}:${warehouse._id.toString()}`;
      const entry = balanceByKey.get(key);
      const onHand = entry?.onHand ?? new Decimal(0);
      const reserved = entry?.reserved ?? new Decimal(0);
      const available = onHand.minus(reserved);

      let severity: LowStockSeverity | null = null;
      if (available.lessThanOrEqualTo(0)) severity = 'out';
      else if (reorderLevel.greaterThan(0) && available.lessThanOrEqualTo(reorderLevel)) {
        severity = 'low';
      }
      if (!severity) continue;

      if (severity === 'out') outOfStockCount += 1;
      else lowStockCount += 1;

      rows.push({
        productId: product._id.toString(),
        sku: product.sku,
        name: product.name,
        warehouseId: warehouse._id.toString(),
        warehouseName: warehouseName.get(warehouse._id.toString()) ?? '—',
        onHandQuantity: onHand.toFixed(),
        availableQuantity: available.toFixed(),
        reorderLevel: reorderLevel.toFixed(),
        severity,
      });
    }
  }

  rows.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'out' ? -1 : 1));

  return { rows, totals: { outOfStockCount, lowStockCount } };
}

// -- Expiring and expired stock ----------------------------------------------

export async function getExpiryReport(
  organizationId: Types.ObjectId,
  query: ExpiryReportQuery,
): Promise<ExpiryReportResponse> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + query.withinDays * 24 * 60 * 60 * 1000);

  const lots = await InventoryLotModel.find({
    organizationId,
    status: 'active',
    expiresAt: { $ne: null, $lte: cutoff },
  }).lean();
  if (lots.length === 0) {
    return { rows: [], totals: { expiredCount: 0, criticalCount: 0, warningCount: 0 } };
  }

  const lotIds = lots.map((lot) => lot._id);
  const balanceFilter: Record<string, unknown> = {
    organizationId,
    lotId: { $in: lotIds },
    stockState: 'available',
  };
  if (query.warehouseId) balanceFilter['warehouseId'] = new Types.ObjectId(query.warehouseId);
  const balances = await StockBalanceModel.find(balanceFilter).lean();

  const remainingByLot = new Map<string, Decimal>();
  const warehouseByLot = new Map<string, Types.ObjectId>();
  for (const balance of balances) {
    const key = balance.lotId?.toString();
    if (!key) continue;
    const existing = remainingByLot.get(key) ?? new Decimal(0);
    remainingByLot.set(key, existing.plus(balance.onHandQuantity.toString()));
    warehouseByLot.set(key, balance.warehouseId);
  }

  const productIds = [...new Set(lots.map((lot) => lot.productId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const products = await ProductModel.find({ organizationId, _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));
  const { warehouseName } = await nameMaps(organizationId, {
    warehouseIds: [...new Set(warehouseByLot.values())],
  });

  let expiredCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  const rows: ExpiryReportResponse['rows'] = [];

  for (const lot of lots) {
    const remaining = remainingByLot.get(lot._id.toString());
    if (!remaining || remaining.lessThanOrEqualTo(0)) continue;
    const warehouseId = warehouseByLot.get(lot._id.toString());
    if (!warehouseId) continue;
    if (query.warehouseId && warehouseId.toString() !== query.warehouseId) continue;

    const product = productById.get(lot.productId.toString());
    if (!product || !lot.expiresAt) continue;

    const daysUntilExpiry = Math.ceil(
      (lot.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    let severity: ExpirySeverity;
    if (daysUntilExpiry <= 0) {
      severity = 'expired';
      expiredCount += 1;
    } else if (daysUntilExpiry <= 7) {
      severity = 'critical';
      criticalCount += 1;
    } else {
      severity = 'warning';
      warningCount += 1;
    }

    rows.push({
      lotId: lot._id.toString(),
      lotNumber: lot.lotNumber,
      productId: product._id.toString(),
      sku: product.sku,
      name: product.name,
      warehouseId: warehouseId.toString(),
      warehouseName: warehouseName.get(warehouseId.toString()) ?? '—',
      expiresAt: lot.expiresAt.toISOString(),
      daysUntilExpiry,
      remainingQuantity: remaining.toFixed(),
      severity,
    });
  }

  rows.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  return { rows, totals: { expiredCount, criticalCount, warningCount } };
}
