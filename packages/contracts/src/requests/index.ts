import { z } from 'zod';
import { nonNegativeDecimalStringSchema, positiveDecimalStringSchema } from '../decimal.js';

/**
 * `partially_fulfilled`/`fulfilled` are reached only by the Issues module
 * posting against this request, never through a generic status field
 * (mirrors `partially_received`/`fully_received` on purchase orders).
 */
export const STOCK_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
] as const;
export type StockRequestStatus = (typeof STOCK_REQUEST_STATUSES)[number];

export const MAX_STOCK_REQUEST_LINES = 200;

export const stockRequestItemInputSchema = z.object({
  productId: z.string(),
  requestedQuantity: positiveDecimalStringSchema,
  note: z.string().trim().max(500).nullable().optional(),
});
export type StockRequestItemInput = z.infer<typeof stockRequestItemInputSchema>;

export const stockRequestItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  requestedQuantity: z.string(),
  approvedQuantity: z.string(),
  reservedQuantity: z.string(),
  fulfilledQuantity: z.string(),
  note: z.string().nullable(),
});
export type StockRequestItemDto = z.infer<typeof stockRequestItemDtoSchema>;

export const createStockRequestRequestSchema = z.object({
  warehouseId: z.string(),
  neededBy: z.string().datetime().nullable().optional(),
  items: z.array(stockRequestItemInputSchema).min(1).max(MAX_STOCK_REQUEST_LINES),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateStockRequestRequest = z.infer<typeof createStockRequestRequestSchema>;

/** Only permitted while the request is still `draft`. */
export const updateStockRequestRequestSchema = z.object({
  warehouseId: z.string().optional(),
  neededBy: z.string().datetime().nullable().optional(),
  items: z.array(stockRequestItemInputSchema).min(1).max(MAX_STOCK_REQUEST_LINES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateStockRequestRequest = z.infer<typeof updateStockRequestRequestSchema>;

/**
 * Per-line approved-quantity overrides. Omitted lines (or an omitted body)
 * approve the full `requestedQuantity`. A line approved at `0` is a partial
 * rejection of that line while the request as a whole still moves to
 * `approved`.
 */
export const approveStockRequestItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  approvedQuantity: nonNegativeDecimalStringSchema,
});
export const approveStockRequestRequestSchema = z.object({
  items: z.array(approveStockRequestItemSchema).max(MAX_STOCK_REQUEST_LINES).optional(),
});
export type ApproveStockRequestRequest = z.infer<typeof approveStockRequestRequestSchema>;

export const rejectStockRequestRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RejectStockRequestRequest = z.infer<typeof rejectStockRequestRequestSchema>;

export const cancelStockRequestRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type CancelStockRequestRequest = z.infer<typeof cancelStockRequestRequestSchema>;

export const stockRequestDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  requestNumber: z.string(),
  warehouseId: z.string(),
  status: z.enum(STOCK_REQUEST_STATUSES),
  neededBy: z.string().nullable(),
  items: z.array(stockRequestItemDtoSchema),
  notes: z.string().nullable(),
  requestedBy: z.string().nullable(),
  submittedBy: z.string().nullable(),
  submittedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  cancelledBy: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StockRequestDto = z.infer<typeof stockRequestDtoSchema>;
