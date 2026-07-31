import { z } from 'zod';
import { codePattern } from '../organization/index.js';
import { nonNegativeDecimalStringSchema } from '../decimal.js';

// --- Categories --------------------------------------------------------------

export const categoryDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  parentId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CategoryDto = z.infer<typeof categoryDtoSchema>;

export const createCategoryRequestSchema = z.object({
  code: z.string().trim().regex(codePattern),
  name: z.string().trim().min(1).max(200),
  parentId: z.string().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;

export const updateCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

// --- Units ---------------------------------------------------------------------

export const unitDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  symbol: z.string(),
  decimalPlaces: z.number().int().min(0).max(6),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UnitDto = z.infer<typeof unitDtoSchema>;

export const createUnitRequestSchema = z.object({
  code: z.string().trim().regex(codePattern),
  name: z.string().trim().min(1).max(100),
  symbol: z.string().trim().min(1).max(16),
  decimalPlaces: z.number().int().min(0).max(6).default(0),
});
export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;

export const updateUnitRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  symbol: z.string().trim().min(1).max(16).optional(),
  decimalPlaces: z.number().int().min(0).max(6).optional(),
});
export type UpdateUnitRequest = z.infer<typeof updateUnitRequestSchema>;

// --- Products --------------------------------------------------------------------

export const PRODUCT_TYPES = ['consumable', 'medicine', 'equipment', 'other'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const productDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  categoryId: z.string(),
  unitId: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  productType: z.enum(PRODUCT_TYPES),
  purchasePrice: z.string(),
  issuePrice: z.string().nullable(),
  reorderLevel: z.string(),
  reorderQuantity: z.string().nullable(),
  trackLots: z.boolean(),
  trackExpiry: z.boolean(),
  expiryWarningDays: z.number().int().nonnegative(),
  allowNegativeStock: z.boolean(),
  status: z.enum(['active', 'inactive', 'archived']),
  barcodes: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProductDto = z.infer<typeof productDtoSchema>;

export const createProductRequestSchema = z
  .object({
    categoryId: z.string(),
    unitId: z.string(),
    sku: z.string().trim().toUpperCase().regex(codePattern),
    name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2000).nullable().optional(),
    productType: z.enum(PRODUCT_TYPES).default('other'),
    purchasePrice: nonNegativeDecimalStringSchema,
    issuePrice: nonNegativeDecimalStringSchema.nullable().optional(),
    reorderLevel: nonNegativeDecimalStringSchema.default('0'),
    reorderQuantity: nonNegativeDecimalStringSchema.nullable().optional(),
    trackLots: z.boolean().default(false),
    trackExpiry: z.boolean().default(false),
    expiryWarningDays: z.number().int().nonnegative().default(90),
    allowNegativeStock: z.boolean().default(false),
    barcodes: z.array(z.string().trim().min(1).max(64)).max(10).default([]),
  })
  .refine((value) => !value.trackExpiry || value.trackLots, {
    message: 'trackExpiry requires trackLots to also be enabled',
    path: ['trackExpiry'],
  });
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

/** Excludes `status` -- lifecycle changes go through the dedicated archive endpoint. */
export const updateProductRequestSchema = z.object({
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  purchasePrice: nonNegativeDecimalStringSchema.optional(),
  issuePrice: nonNegativeDecimalStringSchema.nullable().optional(),
  reorderLevel: nonNegativeDecimalStringSchema.optional(),
  reorderQuantity: nonNegativeDecimalStringSchema.nullable().optional(),
  trackLots: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  expiryWarningDays: z.number().int().nonnegative().optional(),
  allowNegativeStock: z.boolean().optional(),
  barcodes: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
});
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;

export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(25),
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
