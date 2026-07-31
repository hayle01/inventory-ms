import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { SupplierModel } from '../models/Supplier.js';
import { SupplierContactModel } from '../models/SupplierContact.js';

export const createSupplierIndexesMigration: Migration = {
  id: '001-suppliers-create-indexes',
  description: 'Create indexes for suppliers and supplier contacts',
  up: async () => {
    await SupplierModel.createIndexes();
    await SupplierContactModel.createIndexes();
  },
};
