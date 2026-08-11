import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { GoodsReceiptModel } from '../models/GoodsReceipt.js';

export const createReceivingIndexesMigration: Migration = {
  id: '001-receiving-create-indexes',
  description: 'Create indexes for goods receipts',
  up: async () => {
    await GoodsReceiptModel.createIndexes();
  },
};
