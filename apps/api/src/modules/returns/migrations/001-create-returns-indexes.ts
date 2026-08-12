import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { StockReturnModel } from '../models/StockReturn.js';

export const createReturnsIndexesMigration: Migration = {
  id: '001-returns-create-indexes',
  description: 'Create indexes for stock returns',
  up: async () => {
    await StockReturnModel.createIndexes();
  },
};
