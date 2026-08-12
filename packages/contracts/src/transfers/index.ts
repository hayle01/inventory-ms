import { z } from 'zod';
import { positiveDecimalStringSchema } from '../decimal.js';

/**
 * No reject/cancel branch is defined for transfers (only `transfers.view/
 * create/submit/approve/post/reverse` are permission-gated). `in_transit` is
 * only reached when the transfer's `inTransitPolicy` is `in_transit`; an
 * `immediate` transfer's `post` goes straight from `approved` to `completed`.
 */
export const STOCK_TRANSFER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'in_transit',
  'completed',
  'reversed',
] as const;
export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

export const TRANSFER_IN_TRANSIT_POLICIES = ['immediate', 'in_transit'] as const;
export type TransferInTransitPolicy = (typeof TRANSFER_IN_TRANSIT_POLICIES)[number];

export const MAX_STOCK_TRANSFER_LINES = 200;

export const stockTransferItemInputSchema = z
  .object({
    productId: z.string(),
    sourceLocationId: z.string(),
    destinationLocationId: z.string(),
    lotId: z.string().nullable().optional(),
    quantity: positiveDecimalStringSchema,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => value.sourceLocationId !== value.destinationLocationId, {
    message: 'Source and destination locations must be different',
    path: ['destinationLocationId'],
  });
export type StockTransferItemInput = z.infer<typeof stockTransferItemInputSchema>;

export const stockTransferItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  sourceLocationId: z.string(),
  destinationLocationId: z.string(),
  lotId: z.string().nullable(),
  lotNumber: z.string().nullable(),
  quantity: z.string(),
  note: z.string().nullable(),
});
export type StockTransferItemDto = z.infer<typeof stockTransferItemDtoSchema>;

export const createStockTransferRequestSchema = z.object({
  sourceWarehouseId: z.string(),
  destinationWarehouseId: z.string(),
  inTransitPolicy: z.enum(TRANSFER_IN_TRANSIT_POLICIES).default('in_transit'),
  items: z.array(stockTransferItemInputSchema).min(1).max(MAX_STOCK_TRANSFER_LINES),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateStockTransferRequest = z.infer<typeof createStockTransferRequestSchema>;

export const reverseStockTransferRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ReverseStockTransferRequest = z.infer<typeof reverseStockTransferRequestSchema>;

export const stockTransferDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  transferNumber: z.string(),
  sourceWarehouseId: z.string(),
  destinationWarehouseId: z.string(),
  status: z.enum(STOCK_TRANSFER_STATUSES),
  inTransitPolicy: z.enum(TRANSFER_IN_TRANSIT_POLICIES),
  items: z.array(stockTransferItemDtoSchema),
  notes: z.string().nullable(),
  reversalOfId: z.string().nullable(),
  createdBy: z.string().nullable(),
  submittedBy: z.string().nullable(),
  submittedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  postedBy: z.string().nullable(),
  postedAt: z.string().nullable(),
  receivedBy: z.string().nullable(),
  receivedAt: z.string().nullable(),
  reversedBy: z.string().nullable(),
  reversedAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StockTransferDto = z.infer<typeof stockTransferDtoSchema>;
