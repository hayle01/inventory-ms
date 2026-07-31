import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { CategoryModel } from '../models/Category.js';
import { UnitModel } from '../models/Unit.js';
import { ProductModel } from '../models/Product.js';
import { ProductBarcodeModel } from '../models/ProductBarcode.js';

export const createCatalogIndexesMigration: Migration = {
  id: '001-catalog-create-indexes',
  description: 'Create indexes for categories, units, products, and product barcodes',
  up: async () => {
    await CategoryModel.createIndexes();
    await UnitModel.createIndexes();
    await ProductModel.createIndexes();
    await ProductBarcodeModel.createIndexes();
  },
};
