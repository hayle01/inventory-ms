import { z } from 'zod';
import { positiveDecimalStringSchema } from '../decimal.js';

/** No approval or reversal step -- `returns.view/create/post` are the only permissions defined. */
export const STOCK_RETURN_STATUSES = ['draft', 'posted'] as const;
export type StockReturnStatus = (typeof STOCK_RETURN_STATUSES)[number];

export const STOCK_RETURN_CONDITIONS = ['good', 'damaged', 'quarantine'] as const;
export type StockReturnCondition = (typeof STOCK_RETURN_CONDITIONS)[number];

export const MAX_STOCK_RETURN_LINES = 200;

/** Each line returns (part of) a specific line from the original posted issue. */
export const stockReturnItemInputSchema = z.object({
  stockIssueLineNumber: z.number().int().positive(),
  quantity: positiveDecimalStringSchema,
  condition: z.enum(STOCK_RETURN_CONDITIONS).default('good'),
  reason: z.string().trim().max(500).nullable().optional(),
});
export type StockReturnItemInput = z.infer<typeof stockReturnItemInputSchema>;

export const stockReturnItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  stockIssueLineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable(),
  lotNumber: z.string().nullable(),
  quantity: z.string(),
  condition: z.enum(STOCK_RETURN_CONDITIONS),
  reason: z.string().nullable(),
});
export type StockReturnItemDto = z.infer<typeof stockReturnItemDtoSchema>;

export const createStockReturnRequestSchema = z.object({
  stockIssueId: z.string(),
  items: z.array(stockReturnItemInputSchema).min(1).max(MAX_STOCK_RETURN_LINES),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateStockReturnRequest = z.infer<typeof createStockReturnRequestSchema>;

export const stockReturnDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  returnNumber: z.string(),
  stockIssueId: z.string(),
  warehouseId: z.string(),
  status: z.enum(STOCK_RETURN_STATUSES),
  items: z.array(stockReturnItemDtoSchema),
  notes: z.string().nullable(),
  createdBy: z.string().nullable(),
  postedBy: z.string().nullable(),
  postedAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StockReturnDto = z.infer<typeof stockReturnDtoSchema>;
