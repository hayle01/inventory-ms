import type { CategoryDto, ProductDto, UnitDto } from '@inventory-ms/contracts';
import type { CategoryDoc } from '../models/Category.js';
import type { UnitDoc } from '../models/Unit.js';
import type { ProductWithBarcodes } from '../application/ProductService.js';
import { decimal128ToString, decimal128ToStringOrNull } from '../domain/decimalMapping.js';

export function toCategoryDto(category: CategoryDoc): CategoryDto {
  return {
    id: category._id.toString(),
    organizationId: category.organizationId.toString(),
    parentId: category.parentId ? category.parentId.toString() : null,
    code: category.code,
    name: category.name,
    description: category.description ?? null,
    status: category.status,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toUnitDto(unit: UnitDoc): UnitDto {
  return {
    id: unit._id.toString(),
    organizationId: unit.organizationId.toString(),
    code: unit.code,
    name: unit.name,
    symbol: unit.symbol,
    decimalPlaces: unit.decimalPlaces,
    status: unit.status,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

export function toProductDto({ product, barcodes }: ProductWithBarcodes): ProductDto {
  return {
    id: product._id.toString(),
    organizationId: product.organizationId.toString(),
    categoryId: product.categoryId.toString(),
    unitId: product.unitId.toString(),
    sku: product.sku,
    name: product.name,
    description: product.description ?? null,
    productType: product.productType,
    purchasePrice: decimal128ToString(product.purchasePrice),
    issuePrice: decimal128ToStringOrNull(product.issuePrice),
    reorderLevel: decimal128ToString(product.reorderLevel),
    reorderQuantity: decimal128ToStringOrNull(product.reorderQuantity),
    trackLots: product.trackLots,
    trackExpiry: product.trackExpiry,
    expiryWarningDays: product.expiryWarningDays,
    allowNegativeStock: product.allowNegativeStock,
    status: product.status,
    barcodes,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
