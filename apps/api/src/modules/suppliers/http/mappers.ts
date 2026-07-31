import type { SupplierDto } from '@inventory-ms/contracts';
import type { SupplierDoc } from '../models/Supplier.js';

export function toSupplierDto(supplier: SupplierDoc): SupplierDto {
  return {
    id: supplier._id.toString(),
    organizationId: supplier.organizationId.toString(),
    code: supplier.code,
    name: supplier.name,
    addressLine: supplier.addressLine ?? null,
    phone: supplier.phone ?? null,
    email: supplier.email ?? null,
    taxIdentifier: supplier.taxIdentifier ?? null,
    notes: supplier.notes ?? null,
    status: supplier.status,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}
