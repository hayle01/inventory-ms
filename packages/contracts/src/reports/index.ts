import { z } from 'zod';
import { PURCHASE_ORDER_STATUSES } from '../procurement/index.js';
import { STOCK_TRANSACTION_TYPES } from '../inventory/index.js';
import { pageQuerySchema } from '../http/pagination.js';

/** Reports query source records live; the system never copies report facts into a mutable collection. */

// -- Inventory and valuation --------------------------------------------

export const inventoryReportQuerySchema = z.object({
  warehouseId: z.string().optional(),
  categoryId: z.string().optional(),
  includeZero: z.coerce.boolean().default(false),
});
export type InventoryReportQuery = z.infer<typeof inventoryReportQuerySchema>;

export const inventoryReportRowSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  categoryName: z.string().nullable(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  onHandQuantity: z.string(),
  reservedQuantity: z.string(),
  availableQuantity: z.string(),
  unitCost: z.string(),
  valuation: z.string(),
});
export type InventoryReportRow = z.infer<typeof inventoryReportRowSchema>;

export const inventoryReportResponseSchema = z.object({
  rows: z.array(inventoryReportRowSchema),
  totals: z.object({
    onHandQuantity: z.string(),
    valuation: z.string(),
    productCount: z.number().int(),
  }),
});
export type InventoryReportResponse = z.infer<typeof inventoryReportResponseSchema>;

// -- Stock movement --------------------------------------------------------

export const stockMovementReportQuerySchema = z
  .object({
    productId: z.string().optional(),
    warehouseId: z.string().optional(),
    transactionType: z.enum(STOCK_TRANSACTION_TYPES).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .merge(pageQuerySchema);
export type StockMovementReportQuery = z.infer<typeof stockMovementReportQuerySchema>;

export const stockMovementReportRowSchema = z.object({
  id: z.string(),
  transactionNumber: z.string(),
  transactionType: z.enum(STOCK_TRANSACTION_TYPES),
  transactionAt: z.string(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  warehouseId: z.string(),
  quantity: z.string(),
  referenceType: z.string(),
  referenceNumber: z.string(),
});
export type StockMovementReportRow = z.infer<typeof stockMovementReportRowSchema>;

export const stockMovementReportResponseSchema = z.object({
  rows: z.array(stockMovementReportRowSchema),
  summary: z.object({
    totalIn: z.string(),
    totalOut: z.string(),
    net: z.string(),
  }),
});
export type StockMovementReportResponse = z.infer<typeof stockMovementReportResponseSchema>;

// -- Purchases, receipts, outstanding, and supplier activity ---------------

export const purchasesReportQuerySchema = z.object({
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type PurchasesReportQuery = z.infer<typeof purchasesReportQuerySchema>;

export const purchasesReportRowSchema = z.object({
  purchaseOrderId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  warehouseId: z.string(),
  status: z.enum(PURCHASE_ORDER_STATUSES),
  orderDate: z.string().nullable(),
  total: z.string(),
  orderedQuantity: z.string(),
  receivedQuantity: z.string(),
  outstandingQuantity: z.string(),
});
export type PurchasesReportRow = z.infer<typeof purchasesReportRowSchema>;

export const supplierActivityRowSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  purchaseOrderCount: z.number().int(),
  totalValue: z.string(),
  totalOutstandingQuantity: z.string(),
});
export type SupplierActivityRow = z.infer<typeof supplierActivityRowSchema>;

export const purchasesReportResponseSchema = z.object({
  rows: z.array(purchasesReportRowSchema),
  bySupplier: z.array(supplierActivityRowSchema),
  totals: z.object({
    totalValue: z.string(),
    totalOrderedQuantity: z.string(),
    totalReceivedQuantity: z.string(),
    totalOutstandingQuantity: z.string(),
  }),
});
export type PurchasesReportResponse = z.infer<typeof purchasesReportResponseSchema>;

// -- Requests, issues, returns, and distribution ----------------------------

export const issuesReportQuerySchema = z.object({
  warehouseId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type IssuesReportQuery = z.infer<typeof issuesReportQuerySchema>;

export const issueDistributionRowSchema = z.object({
  issueId: z.string(),
  issueNumber: z.string(),
  warehouseId: z.string(),
  status: z.string(),
  postedAt: z.string().nullable(),
  pickedQuantity: z.string(),
  returnedQuantity: z.string(),
});
export type IssueDistributionRow = z.infer<typeof issueDistributionRowSchema>;

export const issuesReportResponseSchema = z.object({
  summary: z.object({
    requestCount: z.number().int(),
    requestedQuantity: z.string(),
    approvedQuantity: z.string(),
    issueCount: z.number().int(),
    issuedQuantity: z.string(),
    returnCount: z.number().int(),
    returnedQuantity: z.string(),
  }),
  rows: z.array(issueDistributionRowSchema),
});
export type IssuesReportResponse = z.infer<typeof issuesReportResponseSchema>;

// -- Low stock and out of stock ---------------------------------------------

export const lowStockReportQuerySchema = z.object({
  warehouseId: z.string().optional(),
});
export type LowStockReportQuery = z.infer<typeof lowStockReportQuerySchema>;

export const LOW_STOCK_SEVERITIES = ['out', 'low'] as const;
export type LowStockSeverity = (typeof LOW_STOCK_SEVERITIES)[number];

export const lowStockReportRowSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  onHandQuantity: z.string(),
  availableQuantity: z.string(),
  reorderLevel: z.string(),
  severity: z.enum(LOW_STOCK_SEVERITIES),
});
export type LowStockReportRow = z.infer<typeof lowStockReportRowSchema>;

export const lowStockReportResponseSchema = z.object({
  rows: z.array(lowStockReportRowSchema),
  totals: z.object({ outOfStockCount: z.number().int(), lowStockCount: z.number().int() }),
});
export type LowStockReportResponse = z.infer<typeof lowStockReportResponseSchema>;

// -- Expiring and expired stock ----------------------------------------------

export const expiryReportQuerySchema = z.object({
  warehouseId: z.string().optional(),
  withinDays: z.coerce.number().int().positive().max(3650).default(90),
});
export type ExpiryReportQuery = z.infer<typeof expiryReportQuerySchema>;

export const EXPIRY_SEVERITIES = ['expired', 'critical', 'warning'] as const;
export type ExpirySeverity = (typeof EXPIRY_SEVERITIES)[number];

export const expiryReportRowSchema = z.object({
  lotId: z.string(),
  lotNumber: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  expiresAt: z.string(),
  daysUntilExpiry: z.number().int(),
  remainingQuantity: z.string(),
  severity: z.enum(EXPIRY_SEVERITIES),
});
export type ExpiryReportRow = z.infer<typeof expiryReportRowSchema>;

export const expiryReportResponseSchema = z.object({
  rows: z.array(expiryReportRowSchema),
  totals: z.object({ expiredCount: z.number().int(), criticalCount: z.number().int(), warningCount: z.number().int() }),
});
export type ExpiryReportResponse = z.infer<typeof expiryReportResponseSchema>;

// -- Audit trail (raw event listing; report UI reuses GET /audit-events) ----

export const auditEventsQuerySchema = z
  .object({
    resourceType: z.string().max(100).optional(),
    action: z.string().max(100).optional(),
    actorId: z.string().optional(),
    outcome: z.enum(['success', 'denied', 'failure']).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .merge(pageQuerySchema);
export type AuditEventsQuery = z.infer<typeof auditEventsQuerySchema>;

export const auditEventDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  actorId: z.string().nullable(),
  actorType: z.enum(['user', 'system']),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  resourceNumber: z.string().nullable(),
  outcome: z.enum(['success', 'denied', 'failure']),
  permissionUsed: z.string().nullable(),
  reason: z.string().nullable(),
  correlationId: z.string(),
  changedFields: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type AuditEventDto = z.infer<typeof auditEventDtoSchema>;
