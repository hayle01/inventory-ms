import { Types } from 'mongoose';
import type {
  CreateProductRequest,
  ProductSearchQuery,
  UpdateProductRequest,
} from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import type { OrgActionContext } from '../../organization/application/DepartmentService.js';
import { CategoryModel } from '../models/Category.js';
import { UnitModel } from '../models/Unit.js';
import { ProductModel, type ProductDoc } from '../models/Product.js';
import { ProductBarcodeModel } from '../models/ProductBarcode.js';
import { toDecimal128, toDecimal128OrNull } from '../domain/decimalMapping.js';

export interface ProductWithBarcodes {
  product: ProductDoc;
  barcodes: string[];
}

async function assertCategoryAndUnit(
  organizationId: Types.ObjectId,
  categoryId: string,
  unitId: string,
): Promise<{ categoryObjectId: Types.ObjectId; unitObjectId: Types.ObjectId }> {
  const categoryObjectId = new Types.ObjectId(categoryId);
  const unitObjectId = new Types.ObjectId(unitId);

  const [category, unit] = await Promise.all([
    CategoryModel.findOne({
      _id: categoryObjectId,
      organizationId,
      status: { $ne: 'archived' },
    }).lean(),
    UnitModel.findOne({ _id: unitObjectId, organizationId, status: { $ne: 'archived' } }).lean(),
  ]);
  if (!category) throw new ValidationError('Category does not exist or is archived.');
  if (!unit) throw new ValidationError('Unit does not exist or is archived.');

  return { categoryObjectId, unitObjectId };
}

async function getBarcodesForProduct(productId: Types.ObjectId): Promise<string[]> {
  const docs = await ProductBarcodeModel.find({ productId }).sort({ isPrimary: -1 }).lean();
  return docs.map((doc) => doc.barcode);
}

export async function listProducts(organizationId: Types.ObjectId): Promise<ProductWithBarcodes[]> {
  const products = await ProductModel.find({ organizationId, status: { $ne: 'archived' } })
    .sort({ name: 1 })
    .lean();
  return Promise.all(
    products.map(async (product) => ({
      product,
      barcodes: await getBarcodesForProduct(product._id),
    })),
  );
}

export async function getProductById(
  organizationId: Types.ObjectId,
  productId: Types.ObjectId,
): Promise<ProductWithBarcodes> {
  const product = await ProductModel.findOne({ _id: productId, organizationId }).lean();
  if (!product) throw new NotFoundError('Product not found.');
  return { product, barcodes: await getBarcodesForProduct(product._id) };
}

export async function searchProducts(
  organizationId: Types.ObjectId,
  query: ProductSearchQuery,
): Promise<{ items: ProductWithBarcodes[]; total: number }> {
  const filter: Record<string, unknown> = { organizationId, status: { $ne: 'archived' } };
  if (query.categoryId) filter['categoryId'] = new Types.ObjectId(query.categoryId);

  if (query.q) {
    const matchingBarcodeProductIds = await ProductBarcodeModel.find({
      organizationId,
      barcode: query.q,
    }).distinct('productId');
    filter['$or'] = [
      { name: { $regex: escapeRegExp(query.q), $options: 'i' } },
      { sku: { $regex: escapeRegExp(query.q), $options: 'i' } },
      { _id: { $in: matchingBarcodeProductIds } },
    ];
  }

  const skip = (query.page - 1) * query.perPage;
  const [products, total] = await Promise.all([
    ProductModel.find(filter).sort({ name: 1 }).skip(skip).limit(query.perPage).lean(),
    ProductModel.countDocuments(filter),
  ]);

  const items = await Promise.all(
    products.map(async (product) => ({
      product,
      barcodes: await getBarcodesForProduct(product._id),
    })),
  );
  return { items, total };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function assertBarcodesAvailable(
  organizationId: Types.ObjectId,
  barcodes: readonly string[],
  excludeProductId?: Types.ObjectId,
): Promise<void> {
  if (barcodes.length === 0) return;
  const duplicateWithinRequest = new Set(barcodes).size !== barcodes.length;
  if (duplicateWithinRequest) throw new ValidationError('Duplicate barcodes in the same request.');

  const conflict = await ProductBarcodeModel.findOne({
    organizationId,
    barcode: { $in: barcodes },
    ...(excludeProductId ? { productId: { $ne: excludeProductId } } : {}),
  }).lean();
  if (conflict)
    throw new ConflictError(
      `Barcode "${conflict.barcode}" is already assigned to another product.`,
    );
}

export async function createProduct(
  context: OrgActionContext,
  input: CreateProductRequest,
): Promise<ProductWithBarcodes> {
  const { categoryObjectId, unitObjectId } = await assertCategoryAndUnit(
    context.organizationId,
    input.categoryId,
    input.unitId,
  );

  const existingSku = await ProductModel.findOne({
    organizationId: context.organizationId,
    sku: input.sku,
  }).lean();
  if (existingSku) throw new ConflictError('A product with this SKU already exists.');

  await assertBarcodesAvailable(context.organizationId, input.barcodes);

  const product = await withTransaction(
    async (session) => {
      const [created] = await ProductModel.create(
        [
          {
            organizationId: context.organizationId,
            categoryId: categoryObjectId,
            unitId: unitObjectId,
            sku: input.sku,
            name: input.name,
            description: input.description ?? null,
            productType: input.productType,
            purchasePrice: toDecimal128(input.purchasePrice),
            issuePrice: toDecimal128OrNull(input.issuePrice),
            reorderLevel: toDecimal128(input.reorderLevel),
            reorderQuantity: toDecimal128OrNull(input.reorderQuantity),
            trackLots: input.trackLots,
            trackExpiry: input.trackExpiry,
            expiryWarningDays: input.expiryWarningDays,
            allowNegativeStock: input.allowNegativeStock,
            createdBy: context.actorId,
            updatedBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Product creation failed unexpectedly.');

      for (const [index, barcode] of input.barcodes.entries()) {
        await ProductBarcodeModel.create(
          [
            {
              organizationId: context.organizationId,
              productId: created._id,
              barcode,
              isPrimary: index === 0,
            },
          ],
          { session },
        );
      }

      return created;
    },
    { correlationId: context.correlationId, operation: 'catalog.product.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'products.create',
    resourceType: 'product',
    resourceId: product._id,
    resourceNumber: product.sku,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return { product: product.toObject(), barcodes: input.barcodes };
}

export async function updateProduct(
  context: OrgActionContext,
  productId: Types.ObjectId,
  input: UpdateProductRequest,
): Promise<ProductWithBarcodes> {
  const existing = await ProductModel.findOne({
    _id: productId,
    organizationId: context.organizationId,
  });
  if (!existing) throw new NotFoundError('Product not found.');
  if (existing.status === 'archived')
    throw new ValidationError('Archived products cannot be modified.');

  if (input.categoryId || input.unitId) {
    await assertCategoryAndUnit(
      context.organizationId,
      input.categoryId ?? existing.categoryId.toString(),
      input.unitId ?? existing.unitId.toString(),
    );
  }
  if (input.barcodes !== undefined) {
    await assertBarcodesAvailable(context.organizationId, input.barcodes, existing._id);
  }

  const changedFields: Record<string, unknown> = {};

  await withTransaction(
    async (session) => {
      const product = await ProductModel.findOne({ _id: productId }).session(session);
      if (!product) throw new NotFoundError('Product not found.');

      if (input.categoryId !== undefined) {
        changedFields['categoryId'] = true;
        product.categoryId = new Types.ObjectId(input.categoryId);
      }
      if (input.unitId !== undefined) {
        changedFields['unitId'] = true;
        product.unitId = new Types.ObjectId(input.unitId);
      }
      if (input.name !== undefined) {
        changedFields['name'] = true;
        product.name = input.name;
      }
      if (input.description !== undefined) {
        changedFields['description'] = true;
        product.description = input.description;
      }
      if (input.productType !== undefined) {
        changedFields['productType'] = true;
        product.productType = input.productType;
      }
      if (input.purchasePrice !== undefined) {
        changedFields['purchasePrice'] = true;
        product.purchasePrice = toDecimal128(input.purchasePrice);
      }
      if (input.issuePrice !== undefined) {
        changedFields['issuePrice'] = true;
        product.issuePrice = toDecimal128OrNull(input.issuePrice);
      }
      if (input.reorderLevel !== undefined) {
        changedFields['reorderLevel'] = true;
        product.reorderLevel = toDecimal128(input.reorderLevel);
      }
      if (input.reorderQuantity !== undefined) {
        changedFields['reorderQuantity'] = true;
        product.reorderQuantity = toDecimal128OrNull(input.reorderQuantity);
      }
      if (input.trackLots !== undefined) {
        changedFields['trackLots'] = true;
        product.trackLots = input.trackLots;
      }
      if (input.trackExpiry !== undefined) {
        changedFields['trackExpiry'] = true;
        product.trackExpiry = input.trackExpiry;
      }
      if (input.expiryWarningDays !== undefined) {
        changedFields['expiryWarningDays'] = true;
        product.expiryWarningDays = input.expiryWarningDays;
      }
      if (input.allowNegativeStock !== undefined) {
        changedFields['allowNegativeStock'] = true;
        product.allowNegativeStock = input.allowNegativeStock;
      }
      if (product.trackExpiry && !product.trackLots) {
        throw new ValidationError('trackExpiry requires trackLots to also be enabled.');
      }
      product.updatedBy = context.actorId;

      await product.save({ session });

      if (input.barcodes !== undefined) {
        changedFields['barcodes'] = true;
        await ProductBarcodeModel.deleteMany({ productId: product._id }, { session });
        for (const [index, barcode] of input.barcodes.entries()) {
          await ProductBarcodeModel.create(
            [
              {
                organizationId: context.organizationId,
                productId: product._id,
                barcode,
                isPrimary: index === 0,
              },
            ],
            { session },
          );
        }
      }
    },
    { correlationId: context.correlationId, operation: 'catalog.product.update' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'products.update',
    resourceType: 'product',
    resourceId: productId,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return getProductById(context.organizationId, productId);
}

export async function archiveProduct(
  context: OrgActionContext,
  productId: Types.ObjectId,
): Promise<ProductWithBarcodes> {
  const product = await ProductModel.findOne({
    _id: productId,
    organizationId: context.organizationId,
  });
  if (!product) throw new NotFoundError('Product not found.');
  if (product.status === 'archived') throw new ValidationError('Product is already archived.');

  product.status = 'archived';
  product.updatedBy = context.actorId;
  await product.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'products.archive',
    resourceType: 'product',
    resourceId: product._id,
    resourceNumber: product.sku,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return { product: product.toObject(), barcodes: await getBarcodesForProduct(product._id) };
}
