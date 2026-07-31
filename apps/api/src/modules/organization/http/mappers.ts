import type {
  DepartmentDto,
  OrganizationDto,
  StorageLocationDto,
  WarehouseDto,
} from '@inventory-ms/contracts';
import type { OrganizationDoc } from '../models/Organization.js';
import type { DepartmentDoc } from '../models/Department.js';
import type { WarehouseDoc } from '../models/Warehouse.js';
import type { StorageLocationDoc } from '../models/StorageLocation.js';

export function toOrganizationDto(org: OrganizationDoc): OrganizationDto {
  return {
    id: org._id.toString(),
    code: org.code,
    name: org.name,
    timezone: org.timezone,
    currencyCode: org.currencyCode,
    status: org.status,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function toDepartmentDto(department: DepartmentDoc): DepartmentDto {
  return {
    id: department._id.toString(),
    organizationId: department.organizationId.toString(),
    code: department.code,
    name: department.name,
    managerUserId: department.managerUserId ? department.managerUserId.toString() : null,
    status: department.status,
    createdAt: department.createdAt.toISOString(),
    updatedAt: department.updatedAt.toISOString(),
  };
}

export function toWarehouseDto(warehouse: WarehouseDoc): WarehouseDto {
  return {
    id: warehouse._id.toString(),
    organizationId: warehouse.organizationId.toString(),
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address ?? null,
    isDefault: warehouse.isDefault,
    status: warehouse.status,
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  };
}

export function toStorageLocationDto(location: StorageLocationDoc): StorageLocationDto {
  return {
    id: location._id.toString(),
    organizationId: location.organizationId.toString(),
    warehouseId: location.warehouseId.toString(),
    code: location.code,
    name: location.name,
    locationType: location.locationType,
    status: location.status,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}
