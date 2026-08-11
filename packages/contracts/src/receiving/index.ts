import { z } from 'zod';
import { Decimal, nonNegativeDecimalStringSchema } from '../decimal.js';

export const GOODS_RECEIPT_STATUSES = ['draft', 'verified', 'posted', 'reversed'] as const;
export type GoodsReceiptStatus = (typeof GOODS_RECEIPT_STATUSES)[number];

export const RECEIPT_ITEM_CONDITIONS = ['good', 'damaged', 'quarantine'] as const;
export type ReceiptItemCondition = (typeof RECEIPT_ITEM_CONDITIONS)[number];

export const MAX_GOODS_RECEIPT_LINES = 200;

export const goodsReceiptItemInputSchema = z
  .object({
    productId: z.string(),
    destinationLocationId: z.string(),
    receivedQuantity: nonNegativeDecimalStringSchema,
    acceptedQuantity: nonNegativeDecimalStringSchema,
    rejectedQuantity: nonNegativeDecimalStringSchema.default('0'),
    unitCost: nonNegativeDecimalStringSchema,
    condition: z.enum(RECEIPT_ITEM_CONDITIONS).default('good'),
    lotNumber: z.string().trim().max(100).nullable().optional(),
    manufacturedAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (value) =>
      new Decimal(value.acceptedQuantity)
        .plus(value.rejectedQuantity)
        .equals(new Decimal(value.receivedQuantity)),
    {
      message: 'acceptedQuantity + rejectedQuantity must equal receivedQuantity',
      path: ['acceptedQuantity'],
    },
  );
export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemInputSchema>;

export const goodsReceiptItemDtoSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  destinationLocationId: z.string(),
  receivedQuantity: z.string(),
  acceptedQuantity: z.string(),
  rejectedQuantity: z.string(),
  unitCost: z.string(),
  condition: z.enum(RECEIPT_ITEM_CONDITIONS),
  lotNumber: z.string().nullable(),
  manufacturedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  notes: z.string().nullable(),
});
export type GoodsReceiptItemDto = z.infer<typeof goodsReceiptItemDtoSchema>;

export const createGoodsReceiptRequestSchema = z.object({
  purchaseOrderId: z.string().nullable().optional(),
  supplierId: z.string(),
  warehouseId: z.string(),
  receivedDate: z.string().datetime().nullable().optional(),
  supplierDocumentNumber: z.string().trim().max(100).nullable().optional(),
  items: z.array(goodsReceiptItemInputSchema).min(1).max(MAX_GOODS_RECEIPT_LINES),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateGoodsReceiptRequest = z.infer<typeof createGoodsReceiptRequestSchema>;

/** Only permitted while the receipt is still `draft`. */
export const updateGoodsReceiptRequestSchema = z.object({
  purchaseOrderId: z.string().nullable().optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  receivedDate: z.string().datetime().nullable().optional(),
  supplierDocumentNumber: z.string().trim().max(100).nullable().optional(),
  items: z.array(goodsReceiptItemInputSchema).min(1).max(MAX_GOODS_RECEIPT_LINES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateGoodsReceiptRequest = z.infer<typeof updateGoodsReceiptRequestSchema>;

export const goodsReceiptDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  receiptNumber: z.string(),
  purchaseOrderId: z.string().nullable(),
  supplierId: z.string(),
  warehouseId: z.string(),
  status: z.enum(GOODS_RECEIPT_STATUSES),
  receivedDate: z.string().nullable(),
  supplierDocumentNumber: z.string().nullable(),
  items: z.array(goodsReceiptItemDtoSchema),
  notes: z.string().nullable(),
  reversalOfId: z.string().nullable(),
  createdBy: z.string().nullable(),
  verifiedBy: z.string().nullable(),
  postedBy: z.string().nullable(),
  reversedBy: z.string().nullable(),
  reversedAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GoodsReceiptDto = z.infer<typeof goodsReceiptDtoSchema>;

export const reverseGoodsReceiptRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ReverseGoodsReceiptRequest = z.infer<typeof reverseGoodsReceiptRequestSchema>;
