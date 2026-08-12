import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { StockTransferModel } from '../models/StockTransfer.js';

export const createTransfersIndexesMigration: Migration = {
  id: '001-transfers-create-indexes',
  description: 'Create indexes for stock transfers',
  up: async () => {
    await StockTransferModel.createIndexes();
  },
};
