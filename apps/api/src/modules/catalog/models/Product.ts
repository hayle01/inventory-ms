import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { PRODUCT_TYPES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const productSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    unitId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    productType: { type: String, required: true, enum: PRODUCT_TYPES, default: 'other' },
    purchasePrice: { type: Schema.Types.Decimal128, required: true },
    issuePrice: { type: Schema.Types.Decimal128, default: null },
    reorderLevel: { type: Schema.Types.Decimal128, required: true, default: '0' },
    reorderQuantity: { type: Schema.Types.Decimal128, default: null },
    trackLots: { type: Boolean, required: true, default: false },
    trackExpiry: { type: Boolean, required: true, default: false },
    expiryWarningDays: { type: Number, required: true, default: 90, min: 0 },
    allowNegativeStock: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
    },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'products' },
);

productSchema.index({ organizationId: 1, sku: 1 }, { unique: true });
productSchema.index({ organizationId: 1, status: 1 });
productSchema.index({ organizationId: 1, name: 'text' });

export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };

export const ProductModel: Model<ProductDoc> = model<ProductDoc>('Product', productSchema);

registerModel('Product', ProductModel);
