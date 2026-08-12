import type { StockReturnDto, StockReturnItemDto } from '@inventory-ms/contracts';
import type { StockReturnDoc } from '../models/StockReturn.js';
import { decimal128ToString } from '../../catalog/domain/decimalMapping.js';

export function toStockReturnDto(stockReturn: StockReturnDoc): StockReturnDto {
  const items: StockReturnItemDto[] = stockReturn.items.map((item) => ({
    lineNumber: item.lineNumber,
    stockIssueLineNumber: item.stockIssueLineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    locationId: item.locationId.toString(),
    lotId: item.lotId ? item.lotId.toString() : null,
    lotNumber: item.lotNumber ?? null,
    quantity: decimal128ToString(item.quantity),
    condition: item.condition,
    reason: item.reason ?? null,
  }));

  return {
    id: stockReturn._id.toString(),
    organizationId: stockReturn.organizationId.toString(),
    returnNumber: stockReturn.returnNumber,
    stockIssueId: stockReturn.stockIssueId.toString(),
    warehouseId: stockReturn.warehouseId.toString(),
    status: stockReturn.status,
    items,
    notes: stockReturn.notes ?? null,
    createdBy: stockReturn.createdBy ? stockReturn.createdBy.toString() : null,
    postedBy: stockReturn.postedBy ? stockReturn.postedBy.toString() : null,
    postedAt: stockReturn.postedAt ? stockReturn.postedAt.toISOString() : null,
    version: stockReturn.version,
    createdAt: stockReturn.createdAt.toISOString(),
    updatedAt: stockReturn.updatedAt.toISOString(),
  };
}
