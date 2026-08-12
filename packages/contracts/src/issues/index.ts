import { z } from 'zod';
import { nonNegativeDecimalStringSchema } from '../decimal.js';

/**
 * SYSTEM_DOCUMENTATION.md section 9.4. `cancelled` is only reachable from
 * `draft`/`picked`, never after posting -- once stock has moved, corrections
 * go through `reversed`.
 */
export const STOCK_ISSUE_STATUSES = ['draft', 'picked', 'posted', 'reversed', 'cancelled'] as const;
export type StockIssueStatus = (typeof STOCK_ISSUE_STATUSES)[number];

export const MAX_STOCK_ISSUE_LINES = 200;

export const stockIssueItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  stockRequestLineNumber: z.number().int().positive().nullable(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable(),
  lotNumber: z.string().nullable(),
  pickedQuantity: z.string(),
  returnedQuantity: z.string(),
  unitCost: z.string().nullable(),
});
export type StockIssueItemDto = z.infer<typeof stockIssueItemDtoSchema>;

/** Creates a draft issue, auto-allocating lines by FEFO/FIFO from the request's outstanding approved quantity. */
export const createStockIssueRequestSchema = z.object({
  stockRequestId: z.string(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateStockIssueRequest = z.infer<typeof createStockIssueRequestSchema>;

/** Clerk override of an auto-allocated pick line. Only permitted while `draft`. */
export const updateStockIssueItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  locationId: z.string(),
  lotId: z.string().nullable().optional(),
  pickedQuantity: nonNegativeDecimalStringSchema,
});
export const updateStockIssueRequestSchema = z.object({
  items: z.array(updateStockIssueItemSchema).min(1).max(MAX_STOCK_ISSUE_LINES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateStockIssueRequest = z.infer<typeof updateStockIssueRequestSchema>;

export const reverseStockIssueRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ReverseStockIssueRequest = z.infer<typeof reverseStockIssueRequestSchema>;

export const cancelStockIssueRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type CancelStockIssueRequest = z.infer<typeof cancelStockIssueRequestSchema>;

export const stockIssueDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  issueNumber: z.string(),
  stockRequestId: z.string(),
  warehouseId: z.string(),
  status: z.enum(STOCK_ISSUE_STATUSES),
  items: z.array(stockIssueItemDtoSchema),
  notes: z.string().nullable(),
  reversalOfId: z.string().nullable(),
  createdBy: z.string().nullable(),
  pickedBy: z.string().nullable(),
  pickedAt: z.string().nullable(),
  postedBy: z.string().nullable(),
  postedAt: z.string().nullable(),
  reversedBy: z.string().nullable(),
  reversedAt: z.string().nullable(),
  cancelledBy: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StockIssueDto = z.infer<typeof stockIssueDtoSchema>;
