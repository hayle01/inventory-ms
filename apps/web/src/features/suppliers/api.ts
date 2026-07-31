import type {
  CreateSupplierRequest,
  SupplierDto,
  UpdateSupplierRequest,
} from '@inventory-ms/contracts';
import { useCrudResource } from '@/lib/useCrudResource';

export function useSuppliers() {
  return useCrudResource<SupplierDto, CreateSupplierRequest, UpdateSupplierRequest>(
    'suppliers',
    '/api/v1/suppliers',
  );
}
