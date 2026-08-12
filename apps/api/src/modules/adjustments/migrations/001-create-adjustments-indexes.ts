import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { StockAdjustmentModel } from '../models/StockAdjustment.js';

export const createAdjustmentsIndexesMigration: Migration = {
  id: '001-adjustments-create-indexes',
  description: 'Create indexes for stock adjustments',
  up: async () => {
    await StockAdjustmentModel.createIndexes();
  },
};
