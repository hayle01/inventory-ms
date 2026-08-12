import type { StockAdjustmentDto, StockAdjustmentItemDto } from '@inventory-ms/contracts';
import type { StockAdjustmentDoc } from '../models/StockAdjustment.js';
import { decimal128ToString, decimal128ToStringOrNull } from '../../catalog/domain/decimalMapping.js';

export function toStockAdjustmentDto(stockAdjustment: StockAdjustmentDoc): StockAdjustmentDto {
  const items: StockAdjustmentItemDto[] = stockAdjustment.items.map((item) => ({
    lineNumber: item.lineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    locationId: item.locationId.toString(),
    lotId: item.lotId ? item.lotId.toString() : null,
    lotNumber: item.lotNumber ?? null,
    stockState: item.stockState,
    quantityDelta: decimal128ToString(item.quantityDelta),
    priorQuantity: decimal128ToStringOrNull(item.priorQuantity),
    resultingQuantity: decimal128ToStringOrNull(item.resultingQuantity),
    note: item.note ?? null,
  }));

  return {
    id: stockAdjustment._id.toString(),
    organizationId: stockAdjustment.organizationId.toString(),
    adjustmentNumber: stockAdjustment.adjustmentNumber,
    warehouseId: stockAdjustment.warehouseId.toString(),
    status: stockAdjustment.status,
    reasonCode: stockAdjustment.reasonCode,
    items,
    requiresElevatedApproval: stockAdjustment.requiresElevatedApproval,
    evidenceNote: stockAdjustment.evidenceNote ?? null,
    notes: stockAdjustment.notes ?? null,
    reversalOfId: stockAdjustment.reversalOfId ? stockAdjustment.reversalOfId.toString() : null,
    createdBy: stockAdjustment.createdBy ? stockAdjustment.createdBy.toString() : null,
    submittedBy: stockAdjustment.submittedBy ? stockAdjustment.submittedBy.toString() : null,
    submittedAt: stockAdjustment.submittedAt ? stockAdjustment.submittedAt.toISOString() : null,
    approvedBy: stockAdjustment.approvedBy ? stockAdjustment.approvedBy.toString() : null,
    approvedAt: stockAdjustment.approvedAt ? stockAdjustment.approvedAt.toISOString() : null,
    rejectedBy: stockAdjustment.rejectedBy ? stockAdjustment.rejectedBy.toString() : null,
    rejectedAt: stockAdjustment.rejectedAt ? stockAdjustment.rejectedAt.toISOString() : null,
    rejectionReason: stockAdjustment.rejectionReason ?? null,
    postedBy: stockAdjustment.postedBy ? stockAdjustment.postedBy.toString() : null,
    postedAt: stockAdjustment.postedAt ? stockAdjustment.postedAt.toISOString() : null,
    reversedBy: stockAdjustment.reversedBy ? stockAdjustment.reversedBy.toString() : null,
    reversedAt: stockAdjustment.reversedAt ? stockAdjustment.reversedAt.toISOString() : null,
    version: stockAdjustment.version,
    createdAt: stockAdjustment.createdAt.toISOString(),
    updatedAt: stockAdjustment.updatedAt.toISOString(),
  };
}
