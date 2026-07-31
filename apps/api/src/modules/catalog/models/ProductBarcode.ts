import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const productBarcodeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, required: true, index: true },
    barcode: { type: String, required: true, trim: true },
    barcodeType: { type: String, required: true, default: 'other' },
    isPrimary: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: 'productBarcodes' },
);

productBarcodeSchema.index({ organizationId: 1, barcode: 1 }, { unique: true });

export type ProductBarcodeDoc = InferSchemaType<typeof productBarcodeSchema> & {
  _id: Types.ObjectId;
};

export const ProductBarcodeModel: Model<ProductBarcodeDoc> = model<ProductBarcodeDoc>(
  'ProductBarcode',
  productBarcodeSchema,
);

registerModel('ProductBarcode', ProductBarcodeModel);
