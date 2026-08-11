import type { GoodsReceiptDto, GoodsReceiptItemDto } from '@inventory-ms/contracts';
import type { GoodsReceiptDoc } from '../models/GoodsReceipt.js';
import { decimal128ToString } from '../../catalog/domain/decimalMapping.js';

export function toGoodsReceiptDto(receipt: GoodsReceiptDoc): GoodsReceiptDto {
  const items: GoodsReceiptItemDto[] = receipt.items.map((item) => ({
    lineNumber: item.lineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    destinationLocationId: item.destinationLocationId.toString(),
    receivedQuantity: decimal128ToString(item.receivedQuantity),
    acceptedQuantity: decimal128ToString(item.acceptedQuantity),
    rejectedQuantity: decimal128ToString(item.rejectedQuantity),
    unitCost: decimal128ToString(item.unitCost),
    condition: item.condition,
    lotNumber: item.lotNumber ?? null,
    manufacturedAt: item.manufacturedAt ? item.manufacturedAt.toISOString() : null,
    expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    notes: item.notes ?? null,
  }));

  return {
    id: receipt._id.toString(),
    organizationId: receipt.organizationId.toString(),
    receiptNumber: receipt.receiptNumber,
    purchaseOrderId: receipt.purchaseOrderId ? receipt.purchaseOrderId.toString() : null,
    supplierId: receipt.supplierId.toString(),
    warehouseId: receipt.warehouseId.toString(),
    status: receipt.status,
    receivedDate: receipt.receivedDate ? receipt.receivedDate.toISOString() : null,
    supplierDocumentNumber: receipt.supplierDocumentNumber ?? null,
    items,
    notes: receipt.notes ?? null,
    reversalOfId: receipt.reversalOfId ? receipt.reversalOfId.toString() : null,
    createdBy: receipt.createdBy ? receipt.createdBy.toString() : null,
    verifiedBy: receipt.verifiedBy ? receipt.verifiedBy.toString() : null,
    postedBy: receipt.postedBy ? receipt.postedBy.toString() : null,
    reversedBy: receipt.reversedBy ? receipt.reversedBy.toString() : null,
    reversedAt: receipt.reversedAt ? receipt.reversedAt.toISOString() : null,
    version: receipt.version,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  };
}
