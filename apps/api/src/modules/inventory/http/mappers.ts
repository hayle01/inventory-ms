import type { StockBalanceDto, StockTransactionDto } from '@inventory-ms/contracts';
import type { StockBalanceDoc } from '../models/StockBalance.js';
import type { StockTransactionDoc } from '../models/StockTransaction.js';
import {
  decimal128ToString,
  decimal128ToStringOrNull,
} from '../../catalog/domain/decimalMapping.js';
import { Decimal } from 'decimal.js';

export function toStockBalanceDto(balance: StockBalanceDoc): StockBalanceDto {
  const onHand = decimal128ToString(balance.onHandQuantity);
  const reserved = decimal128ToString(balance.reservedQuantity);
  return {
    id: balance._id.toString(),
    organizationId: balance.organizationId.toString(),
    warehouseId: balance.warehouseId.toString(),
    locationId: balance.locationId.toString(),
    productId: balance.productId.toString(),
    lotId: balance.lotId ? balance.lotId.toString() : null,
    stockState: balance.stockState,
    onHandQuantity: onHand,
    reservedQuantity: reserved,
    availableQuantity: new Decimal(onHand).minus(reserved).toFixed(),
    version: balance.version,
    lastTransactionAt: balance.lastTransactionAt ? balance.lastTransactionAt.toISOString() : null,
    updatedAt: balance.updatedAt.toISOString(),
  };
}

export function toStockTransactionDto(transaction: StockTransactionDoc): StockTransactionDto {
  return {
    id: transaction._id.toString(),
    organizationId: transaction.organizationId.toString(),
    transactionNumber: transaction.transactionNumber,
    transactionType: transaction.transactionType,
    transactionAt: transaction.transactionAt.toISOString(),
    productId: transaction.productId.toString(),
    warehouseId: transaction.warehouseId.toString(),
    locationId: transaction.locationId.toString(),
    lotId: transaction.lotId ? transaction.lotId.toString() : null,
    stockState: transaction.stockState,
    quantity: decimal128ToString(transaction.quantity),
    unitCost: decimal128ToStringOrNull(transaction.unitCost),
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId.toString(),
    referenceNumber: transaction.referenceNumber,
    reasonCode: transaction.reasonCode ?? null,
    createdBy: transaction.createdBy ? transaction.createdBy.toString() : null,
    correlationId: transaction.correlationId,
    createdAt: transaction.createdAt.toISOString(),
  };
}
