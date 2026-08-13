import type { PurchaseOrderDto, PurchaseOrderItemDto } from '@inventory-ms/contracts';
import type { PurchaseOrderDoc } from '../models/PurchaseOrder.js';
import { decimal128ToString } from '../../catalog/domain/decimalMapping.js';

export function toPurchaseOrderDto(po: PurchaseOrderDoc): PurchaseOrderDto {
  const items: PurchaseOrderItemDto[] = po.items.map((item) => ({
    lineNumber: item.lineNumber,
    productId: item.productId.toString(),
    productName: item.productName,
    productSku: item.productSku,
    orderedQuantity: decimal128ToString(item.orderedQuantity),
    receivedQuantity: decimal128ToString(item.receivedQuantity),
    unitCost: decimal128ToString(item.unitCost),
    taxAmount: decimal128ToString(item.taxAmount),
    discountAmount: decimal128ToString(item.discountAmount),
    lineTotal: decimal128ToString(item.lineTotal),
  }));

  return {
    id: po._id.toString(),
    organizationId: po.organizationId.toString(),
    poNumber: po.poNumber,
    supplierId: po.supplierId.toString(),
    warehouseId: po.warehouseId.toString(),
    status: po.status,
    orderDate: po.orderDate ? po.orderDate.toISOString() : null,
    expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
    currencyCode: po.currencyCode,
    subtotal: decimal128ToString(po.subtotal),
    taxTotal: decimal128ToString(po.taxTotal),
    discountTotal: decimal128ToString(po.discountTotal),
    total: decimal128ToString(po.total),
    items,
    notes: po.notes ?? null,
    createdBy: po.createdBy ? po.createdBy.toString() : null,
    submittedBy: po.submittedBy ? po.submittedBy.toString() : null,
    approvedBy: po.approvedBy ? po.approvedBy.toString() : null,
    rejectedBy: po.rejectedBy ? po.rejectedBy.toString() : null,
    rejectionReason: po.rejectionReason ?? null,
    cancelledBy: po.cancelledBy ? po.cancelledBy.toString() : null,
    cancellationReason: po.cancellationReason ?? null,
    closedBy: po.closedBy ? po.closedBy.toString() : null,
    version: po.version,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
  };
}
