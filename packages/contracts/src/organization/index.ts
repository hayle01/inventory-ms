import { z } from 'zod';

export const codePattern = /^[A-Za-z0-9_-]{1,32}$/;

export const organizationDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  timezone: z.string(),
  currencyCode: z.string(),
  status: z.enum(['active', 'suspended']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrganizationDto = z.infer<typeof organizationDtoSchema>;

/** Only the fields an administrator may change post-bootstrap. */
export const updateOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  currencyCode: z.string().trim().length(3).optional(),
});
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;

// --- Departments -----------------------------------------------------------

export const departmentDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  managerUserId: z.string().nullable(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DepartmentDto = z.infer<typeof departmentDtoSchema>;

export const createDepartmentRequestSchema = z.object({
  code: z.string().trim().regex(codePattern),
  name: z.string().trim().min(1).max(200),
  managerUserId: z.string().nullable().optional(),
});
export type CreateDepartmentRequest = z.infer<typeof createDepartmentRequestSchema>;

export const updateDepartmentRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  managerUserId: z.string().nullable().optional(),
});
export type UpdateDepartmentRequest = z.infer<typeof updateDepartmentRequestSchema>;

// --- Warehouses --------------------------------------------------------------

export const warehouseDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  isDefault: z.boolean(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WarehouseDto = z.infer<typeof warehouseDtoSchema>;

export const createWarehouseRequestSchema = z.object({
  code: z.string().trim().regex(codePattern),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
});
export type CreateWarehouseRequest = z.infer<typeof createWarehouseRequestSchema>;

export const updateWarehouseRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateWarehouseRequest = z.infer<typeof updateWarehouseRequestSchema>;

// --- Storage locations -------------------------------------------------------

export const LOCATION_TYPES = ['normal', 'quarantine', 'damaged', 'expired', 'in_transit'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const storageLocationDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  locationType: z.enum(LOCATION_TYPES),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StorageLocationDto = z.infer<typeof storageLocationDtoSchema>;

export const createStorageLocationRequestSchema = z.object({
  code: z.string().trim().regex(codePattern),
  name: z.string().trim().min(1).max(200),
  locationType: z.enum(LOCATION_TYPES).default('normal'),
});
export type CreateStorageLocationRequest = z.infer<typeof createStorageLocationRequestSchema>;

export const updateStorageLocationRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  locationType: z.enum(LOCATION_TYPES).optional(),
});
export type UpdateStorageLocationRequest = z.infer<typeof updateStorageLocationRequestSchema>;
