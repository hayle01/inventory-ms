import type { StockTransferDto, StockTransferItemDto } from '@inventory-ms/contracts';
import type { StockTransferDoc } from '../models/StockTransfer.js';
import { decimal128ToString } from '../../catalog/domain/decimalMapping.js';

export function toStockTransferDto(stockTransfer: StockTransferDoc): StockTransferDto {
  const items: StockTransferItemDto[] = stockTransfer.items.map((item) => ({
    lineNumber: item.lineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    sourceLocationId: item.sourceLocationId.toString(),
    destinationLocationId: item.destinationLocationId.toString(),
    lotId: item.lotId ? item.lotId.toString() : null,
    lotNumber: item.lotNumber ?? null,
    quantity: decimal128ToString(item.quantity),
    note: item.note ?? null,
  }));

  return {
    id: stockTransfer._id.toString(),
    organizationId: stockTransfer.organizationId.toString(),
    transferNumber: stockTransfer.transferNumber,
    sourceWarehouseId: stockTransfer.sourceWarehouseId.toString(),
    destinationWarehouseId: stockTransfer.destinationWarehouseId.toString(),
    status: stockTransfer.status,
    inTransitPolicy: stockTransfer.inTransitPolicy,
    items,
    notes: stockTransfer.notes ?? null,
    reversalOfId: stockTransfer.reversalOfId ? stockTransfer.reversalOfId.toString() : null,
    createdBy: stockTransfer.createdBy ? stockTransfer.createdBy.toString() : null,
    submittedBy: stockTransfer.submittedBy ? stockTransfer.submittedBy.toString() : null,
    submittedAt: stockTransfer.submittedAt ? stockTransfer.submittedAt.toISOString() : null,
    approvedBy: stockTransfer.approvedBy ? stockTransfer.approvedBy.toString() : null,
    approvedAt: stockTransfer.approvedAt ? stockTransfer.approvedAt.toISOString() : null,
    postedBy: stockTransfer.postedBy ? stockTransfer.postedBy.toString() : null,
    postedAt: stockTransfer.postedAt ? stockTransfer.postedAt.toISOString() : null,
    receivedBy: stockTransfer.receivedBy ? stockTransfer.receivedBy.toString() : null,
    receivedAt: stockTransfer.receivedAt ? stockTransfer.receivedAt.toISOString() : null,
    reversedBy: stockTransfer.reversedBy ? stockTransfer.reversedBy.toString() : null,
    reversedAt: stockTransfer.reversedAt ? stockTransfer.reversedAt.toISOString() : null,
    version: stockTransfer.version,
    createdAt: stockTransfer.createdAt.toISOString(),
    updatedAt: stockTransfer.updatedAt.toISOString(),
  };
}
