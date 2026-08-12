import type { StockCountDto, StockCountItemDto } from '@inventory-ms/contracts';
import type { StockCountDoc } from '../models/StockCount.js';
import { decimal128ToString, decimal128ToStringOrNull } from '../../catalog/domain/decimalMapping.js';

export function toStockCountDto(stockCount: StockCountDoc): StockCountDto {
  const items: StockCountItemDto[] = stockCount.items.map((item) => ({
    lineNumber: item.lineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    locationId: item.locationId.toString(),
    lotId: item.lotId ? item.lotId.toString() : null,
    lotNumber: item.lotNumber ?? null,
    systemQuantity: decimal128ToString(item.systemQuantity),
    countedQuantity: decimal128ToStringOrNull(item.countedQuantity),
    varianceQuantity: decimal128ToStringOrNull(item.varianceQuantity),
    note: item.note ?? null,
  }));

  return {
    id: stockCount._id.toString(),
    organizationId: stockCount.organizationId.toString(),
    countNumber: stockCount.countNumber,
    warehouseId: stockCount.warehouseId.toString(),
    status: stockCount.status,
    scope: stockCount.scope,
    blindCount: stockCount.blindCount,
    snapshotAt: stockCount.snapshotAt.toISOString(),
    items,
    varianceLineCount: items.filter(
      (item) => item.varianceQuantity !== null && item.varianceQuantity !== '0',
    ).length,
    notes: stockCount.notes ?? null,
    reversalOfId: stockCount.reversalOfId ? stockCount.reversalOfId.toString() : null,
    createdBy: stockCount.createdBy ? stockCount.createdBy.toString() : null,
    submittedBy: stockCount.submittedBy ? stockCount.submittedBy.toString() : null,
    submittedAt: stockCount.submittedAt ? stockCount.submittedAt.toISOString() : null,
    approvedBy: stockCount.approvedBy ? stockCount.approvedBy.toString() : null,
    approvedAt: stockCount.approvedAt ? stockCount.approvedAt.toISOString() : null,
    rejectedBy: stockCount.rejectedBy ? stockCount.rejectedBy.toString() : null,
    rejectedAt: stockCount.rejectedAt ? stockCount.rejectedAt.toISOString() : null,
    rejectionReason: stockCount.rejectionReason ?? null,
    postedBy: stockCount.postedBy ? stockCount.postedBy.toString() : null,
    postedAt: stockCount.postedAt ? stockCount.postedAt.toISOString() : null,
    reversedBy: stockCount.reversedBy ? stockCount.reversedBy.toString() : null,
    reversedAt: stockCount.reversedAt ? stockCount.reversedAt.toISOString() : null,
    version: stockCount.version,
    createdAt: stockCount.createdAt.toISOString(),
    updatedAt: stockCount.updatedAt.toISOString(),
  };
}
