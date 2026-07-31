import type { CreateDepartmentRequest, DepartmentDto, UpdateDepartmentRequest } from '@inventory-ms/contracts';
import { useCrudResource } from '@/lib/useCrudResource';

export function useDepartments() {
  return useCrudResource<DepartmentDto, CreateDepartmentRequest, UpdateDepartmentRequest>(
    'departments',
    '/api/v1/departments',
  );
}
