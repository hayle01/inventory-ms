import { z } from 'zod';
import { codePattern } from '../organization/index.js';

export const supplierContactDtoSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  name: z.string(),
  jobTitle: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  isPrimary: z.boolean(),
});
export type SupplierContactDto = z.infer<typeof supplierContactDtoSchema>;

export const createSupplierContactRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  isPrimary: z.boolean().optional(),
});
export type CreateSupplierContactRequest = z.infer<typeof createSupplierContactRequestSchema>;

export const supplierDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  addressLine: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  taxIdentifier: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SupplierDto = z.infer<typeof supplierDtoSchema>;

export const createSupplierRequestSchema = z.object({
  code: z.string().trim().regex(codePattern),
  name: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  taxIdentifier: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>;

export const updateSupplierRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  addressLine: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  taxIdentifier: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>;
