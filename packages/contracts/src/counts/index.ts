import { z } from 'zod';
import { nonNegativeDecimalStringSchema } from '../decimal.js';

/** SYSTEM_DOCUMENTATION.md section 9.5 (shared with Adjustments). */
export const STOCK_COUNT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'posted',
  'reversed',
] as const;
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];

export const STOCK_COUNT_SCOPES = ['cycle', 'full'] as const;
export type StockCountScope = (typeof STOCK_COUNT_SCOPES)[number];

export const MAX_STOCK_COUNT_LINES = 500;

/** Which product/location (and optionally lot) combinations to count -- the system snapshots `systemQuantity` for each at creation time. */
export const stockCountLineSelectorSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable().optional(),
});
export type StockCountLineSelector = z.infer<typeof stockCountLineSelectorSchema>;

export const createStockCountRequestSchema = z.object({
  warehouseId: z.string(),
  scope: z.enum(STOCK_COUNT_SCOPES),
  blindCount: z.boolean().default(true),
  items: z.array(stockCountLineSelectorSchema).min(1).max(MAX_STOCK_COUNT_LINES),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateStockCountRequest = z.infer<typeof createStockCountRequestSchema>;

/** Clerk's counted quantities, entered progressively while the count is still `draft`. */
export const stockCountEntrySchema = z.object({
  lineNumber: z.number().int().positive(),
  countedQuantity: nonNegativeDecimalStringSchema,
  note: z.string().trim().max(500).nullable().optional(),
});
export const updateStockCountRequestSchema = z.object({
  items: z.array(stockCountEntrySchema).min(1).max(MAX_STOCK_COUNT_LINES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateStockCountRequest = z.infer<typeof updateStockCountRequestSchema>;

export const rejectStockCountRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RejectStockCountRequest = z.infer<typeof rejectStockCountRequestSchema>;

export const reverseStockCountRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ReverseStockCountRequest = z.infer<typeof reverseStockCountRequestSchema>;

export const stockCountItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable(),
  lotNumber: z.string().nullable(),
  systemQuantity: z.string(),
  countedQuantity: z.string().nullable(),
  varianceQuantity: z.string().nullable(),
  note: z.string().nullable(),
});
export type StockCountItemDto = z.infer<typeof stockCountItemDtoSchema>;

export const stockCountDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  countNumber: z.string(),
  warehouseId: z.string(),
  status: z.enum(STOCK_COUNT_STATUSES),
  scope: z.enum(STOCK_COUNT_SCOPES),
  blindCount: z.boolean(),
  snapshotAt: z.string(),
  items: z.array(stockCountItemDtoSchema),
  varianceLineCount: z.number().int(),
  notes: z.string().nullable(),
  reversalOfId: z.string().nullable(),
  createdBy: z.string().nullable(),
  submittedBy: z.string().nullable(),
  submittedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  postedBy: z.string().nullable(),
  postedAt: z.string().nullable(),
  reversedBy: z.string().nullable(),
  reversedAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StockCountDto = z.infer<typeof stockCountDtoSchema>;
