import { z } from 'zod';

export const STOCK_TRANSACTION_TYPES = [
  'opening',
  'receipt',
  'issue',
  'return',
  'adjustment',
  'transfer',
  'reversal',
] as const;
export type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number];

export const STOCK_STATES = [
  'available',
  'quarantine',
  'damaged',
  'expired',
  'in_transit',
] as const;
export type StockState = (typeof STOCK_STATES)[number];

export const stockTransactionDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  transactionNumber: z.string(),
  transactionType: z.enum(STOCK_TRANSACTION_TYPES),
  transactionAt: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  locationId: z.string(),
  lotId: z.string().nullable(),
  stockState: z.enum(STOCK_STATES),
  quantity: z.string(),
  unitCost: z.string().nullable(),
  referenceType: z.string(),
  referenceId: z.string(),
  referenceNumber: z.string(),
  reasonCode: z.string().nullable(),
  createdBy: z.string().nullable(),
  correlationId: z.string(),
  createdAt: z.string(),
});
export type StockTransactionDto = z.infer<typeof stockTransactionDtoSchema>;

export const stockBalanceDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  warehouseId: z.string(),
  locationId: z.string(),
  productId: z.string(),
  lotId: z.string().nullable(),
  stockState: z.enum(STOCK_STATES),
  onHandQuantity: z.string(),
  reservedQuantity: z.string(),
  availableQuantity: z.string(),
  version: z.number().int(),
  lastTransactionAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type StockBalanceDto = z.infer<typeof stockBalanceDtoSchema>;

export const inventoryQuerySchema = z.object({
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
});
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
