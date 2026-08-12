import type { StockRequestDto, StockRequestItemDto } from '@inventory-ms/contracts';
import type { StockRequestDoc } from '../models/StockRequest.js';
import { decimal128ToString } from '../../catalog/domain/decimalMapping.js';

export function toStockRequestDto(stockRequest: StockRequestDoc): StockRequestDto {
  const items: StockRequestItemDto[] = stockRequest.items.map((item) => ({
    lineNumber: item.lineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    requestedQuantity: decimal128ToString(item.requestedQuantity),
    approvedQuantity: decimal128ToString(item.approvedQuantity),
    reservedQuantity: decimal128ToString(item.reservedQuantity),
    fulfilledQuantity: decimal128ToString(item.fulfilledQuantity),
    note: item.note ?? null,
  }));

  return {
    id: stockRequest._id.toString(),
    organizationId: stockRequest.organizationId.toString(),
    requestNumber: stockRequest.requestNumber,
    warehouseId: stockRequest.warehouseId.toString(),
    status: stockRequest.status,
    neededBy: stockRequest.neededBy ? stockRequest.neededBy.toISOString() : null,
    items,
    notes: stockRequest.notes ?? null,
    requestedBy: stockRequest.requestedBy ? stockRequest.requestedBy.toString() : null,
    submittedBy: stockRequest.submittedBy ? stockRequest.submittedBy.toString() : null,
    submittedAt: stockRequest.submittedAt ? stockRequest.submittedAt.toISOString() : null,
    approvedBy: stockRequest.approvedBy ? stockRequest.approvedBy.toString() : null,
    approvedAt: stockRequest.approvedAt ? stockRequest.approvedAt.toISOString() : null,
    rejectedBy: stockRequest.rejectedBy ? stockRequest.rejectedBy.toString() : null,
    rejectedAt: stockRequest.rejectedAt ? stockRequest.rejectedAt.toISOString() : null,
    rejectionReason: stockRequest.rejectionReason ?? null,
    cancelledBy: stockRequest.cancelledBy ? stockRequest.cancelledBy.toString() : null,
    cancelledAt: stockRequest.cancelledAt ? stockRequest.cancelledAt.toISOString() : null,
    cancellationReason: stockRequest.cancellationReason ?? null,
    version: stockRequest.version,
    createdAt: stockRequest.createdAt.toISOString(),
    updatedAt: stockRequest.updatedAt.toISOString(),
  };
}
