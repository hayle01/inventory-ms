import { z } from 'zod';
import { nonNegativeDecimalStringSchema, positiveDecimalStringSchema } from '../decimal.js';

export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'partially_received',
  'fully_received',
  'closed',
  'cancelled',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const MAX_PURCHASE_ORDER_LINES = 200;

export const purchaseOrderItemInputSchema = z.object({
  productId: z.string(),
  orderedQuantity: positiveDecimalStringSchema,
  unitCost: nonNegativeDecimalStringSchema,
  taxAmount: nonNegativeDecimalStringSchema.default('0'),
  discountAmount: nonNegativeDecimalStringSchema.default('0'),
});
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemInputSchema>;

export const purchaseOrderItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  orderedQuantity: z.string(),
  receivedQuantity: z.string(),
  unitCost: z.string(),
  taxAmount: z.string(),
  discountAmount: z.string(),
  lineTotal: z.string(),
});
export type PurchaseOrderItemDto = z.infer<typeof purchaseOrderItemDtoSchema>;

export const purchaseOrderDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  warehouseId: z.string(),
  status: z.enum(PURCHASE_ORDER_STATUSES),
  orderDate: z.string().nullable(),
  expectedDate: z.string().nullable(),
  currencyCode: z.string(),
  subtotal: z.string(),
  taxTotal: z.string(),
  discountTotal: z.string(),
  total: z.string(),
  items: z.array(purchaseOrderItemDtoSchema),
  notes: z.string().nullable(),
  createdBy: z.string().nullable(),
  submittedBy: z.string().nullable(),
  approvedBy: z.string().nullable(),
  rejectedBy: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  cancelledBy: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  closedBy: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PurchaseOrderDto = z.infer<typeof purchaseOrderDtoSchema>;

export const createPurchaseOrderRequestSchema = z.object({
  supplierId: z.string(),
  warehouseId: z.string(),
  orderDate: z.string().datetime().nullable().optional(),
  expectedDate: z.string().datetime().nullable().optional(),
  currencyCode: z.string().trim().length(3).default('USD'),
  items: z.array(purchaseOrderItemInputSchema).min(1).max(MAX_PURCHASE_ORDER_LINES),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreatePurchaseOrderRequest = z.infer<typeof createPurchaseOrderRequestSchema>;

/** Only permitted while the order is still `draft`. */
export const updatePurchaseOrderRequestSchema = z.object({
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  orderDate: z.string().datetime().nullable().optional(),
  expectedDate: z.string().datetime().nullable().optional(),
  currencyCode: z.string().trim().length(3).optional(),
  items: z.array(purchaseOrderItemInputSchema).min(1).max(MAX_PURCHASE_ORDER_LINES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdatePurchaseOrderRequest = z.infer<typeof updatePurchaseOrderRequestSchema>;

export const rejectPurchaseOrderRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RejectPurchaseOrderRequest = z.infer<typeof rejectPurchaseOrderRequestSchema>;

export const cancelPurchaseOrderRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type CancelPurchaseOrderRequest = z.infer<typeof cancelPurchaseOrderRequestSchema>;
