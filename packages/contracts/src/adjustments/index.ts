import { z } from 'zod';
import { Decimal, decimalStringSchema } from '../decimal.js';
import { STOCK_STATES } from '../inventory/index.js';

/** SYSTEM_DOCUMENTATION.md section 9.5. No cancel branch is defined for adjustments. */
export const STOCK_ADJUSTMENT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'posted',
  'reversed',
] as const;
export type StockAdjustmentStatus = (typeof STOCK_ADJUSTMENT_STATUSES)[number];

export const ADJUSTMENT_REASON_CODES = [
  'damage',
  'theft',
  'expiry',
  'count_correction',
  'system_error',
  'other',
] as const;
export type AdjustmentReasonCode = (typeof ADJUSTMENT_REASON_CODES)[number];

export const MAX_STOCK_ADJUSTMENT_LINES = 200;

/** `quantityDelta` is signed: positive increases on-hand, negative decreases it. */
export const stockAdjustmentItemInputSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable().optional(),
  stockState: z.enum(STOCK_STATES).default('available'),
  quantityDelta: decimalStringSchema.refine((value) => !new Decimal(value).isZero(), {
    message: 'quantityDelta must not be zero',
  }),
  note: z.string().trim().max(500).nullable().optional(),
});
export type StockAdjustmentItemInput = z.infer<typeof stockAdjustmentItemInputSchema>;

export const stockAdjustmentItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable(),
  lotNumber: z.string().nullable(),
  stockState: z.enum(STOCK_STATES),
  quantityDelta: z.string(),
  priorQuantity: z.string().nullable(),
  resultingQuantity: z.string().nullable(),
  note: z.string().nullable(),
});
export type StockAdjustmentItemDto = z.infer<typeof stockAdjustmentItemDtoSchema>;

export const createStockAdjustmentRequestSchema = z.object({
  warehouseId: z.string(),
  reasonCode: z.enum(ADJUSTMENT_REASON_CODES),
  items: z.array(stockAdjustmentItemInputSchema).min(1).max(MAX_STOCK_ADJUSTMENT_LINES),
  evidenceNote: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateStockAdjustmentRequest = z.infer<typeof createStockAdjustmentRequestSchema>;

/** Only permitted while the adjustment is still `draft`. */
export const updateStockAdjustmentRequestSchema = z.object({
  reasonCode: z.enum(ADJUSTMENT_REASON_CODES).optional(),
  items: z.array(stockAdjustmentItemInputSchema).min(1).max(MAX_STOCK_ADJUSTMENT_LINES).optional(),
  evidenceNote: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateStockAdjustmentRequest = z.infer<typeof updateStockAdjustmentRequestSchema>;

export const rejectStockAdjustmentRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RejectStockAdjustmentRequest = z.infer<typeof rejectStockAdjustmentRequestSchema>;

export const reverseStockAdjustmentRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ReverseStockAdjustmentRequest = z.infer<typeof reverseStockAdjustmentRequestSchema>;

export const stockAdjustmentDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  adjustmentNumber: z.string(),
  warehouseId: z.string(),
  status: z.enum(STOCK_ADJUSTMENT_STATUSES),
  reasonCode: z.enum(ADJUSTMENT_REASON_CODES),
  items: z.array(stockAdjustmentItemDtoSchema),
  /** Snapshot of whether this adjustment's magnitude crossed the material-quantity policy threshold at creation time. */
  requiresElevatedApproval: z.boolean(),
  evidenceNote: z.string().nullable(),
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
export type StockAdjustmentDto = z.infer<typeof stockAdjustmentDtoSchema>;
