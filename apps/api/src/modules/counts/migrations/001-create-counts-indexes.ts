import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { StockCountModel } from '../models/StockCount.js';

export const createCountsIndexesMigration: Migration = {
  id: '001-counts-create-indexes',
  description: 'Create indexes for stock counts',
  up: async () => {
    await StockCountModel.createIndexes();
  },
};
