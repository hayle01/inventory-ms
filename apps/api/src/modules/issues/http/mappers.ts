import type { StockIssueDto, StockIssueItemDto } from '@inventory-ms/contracts';
import type { StockIssueDoc } from '../models/StockIssue.js';
import { decimal128ToString, decimal128ToStringOrNull } from '../../catalog/domain/decimalMapping.js';

export function toStockIssueDto(stockIssue: StockIssueDoc): StockIssueDto {
  const items: StockIssueItemDto[] = stockIssue.items.map((item) => ({
    lineNumber: item.lineNumber,
    stockRequestLineNumber: item.stockRequestLineNumber ?? null,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    locationId: item.locationId.toString(),
    lotId: item.lotId ? item.lotId.toString() : null,
    lotNumber: item.lotNumber ?? null,
    pickedQuantity: decimal128ToString(item.pickedQuantity),
    returnedQuantity: decimal128ToString(item.returnedQuantity),
    unitCost: decimal128ToStringOrNull(item.unitCost),
  }));

  return {
    id: stockIssue._id.toString(),
    organizationId: stockIssue.organizationId.toString(),
    issueNumber: stockIssue.issueNumber,
    stockRequestId: stockIssue.stockRequestId.toString(),
    warehouseId: stockIssue.warehouseId.toString(),
    status: stockIssue.status,
    items,
    notes: stockIssue.notes ?? null,
    reversalOfId: stockIssue.reversalOfId ? stockIssue.reversalOfId.toString() : null,
    createdBy: stockIssue.createdBy ? stockIssue.createdBy.toString() : null,
    pickedBy: stockIssue.pickedBy ? stockIssue.pickedBy.toString() : null,
    pickedAt: stockIssue.pickedAt ? stockIssue.pickedAt.toISOString() : null,
    postedBy: stockIssue.postedBy ? stockIssue.postedBy.toString() : null,
    postedAt: stockIssue.postedAt ? stockIssue.postedAt.toISOString() : null,
    reversedBy: stockIssue.reversedBy ? stockIssue.reversedBy.toString() : null,
    reversedAt: stockIssue.reversedAt ? stockIssue.reversedAt.toISOString() : null,
    cancelledBy: stockIssue.cancelledBy ? stockIssue.cancelledBy.toString() : null,
    cancelledAt: stockIssue.cancelledAt ? stockIssue.cancelledAt.toISOString() : null,
    cancellationReason: stockIssue.cancellationReason ?? null,
    version: stockIssue.version,
    createdAt: stockIssue.createdAt.toISOString(),
    updatedAt: stockIssue.updatedAt.toISOString(),
  };
}
