import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { PurchaseOrderModel } from '../models/PurchaseOrder.js';

export const createProcurementIndexesMigration: Migration = {
  id: '001-procurement-create-indexes',
  description: 'Create indexes for purchase orders',
  up: async () => {
    await PurchaseOrderModel.createIndexes();
  },
};
