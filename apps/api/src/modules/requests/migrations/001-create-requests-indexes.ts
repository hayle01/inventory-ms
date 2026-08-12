import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { StockRequestModel } from '../models/StockRequest.js';

export const createRequestsIndexesMigration: Migration = {
  id: '001-requests-create-indexes',
  description: 'Create indexes for stock requests',
  up: async () => {
    await StockRequestModel.createIndexes();
  },
};
