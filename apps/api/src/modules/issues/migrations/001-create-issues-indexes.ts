import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { StockIssueModel } from '../models/StockIssue.js';

export const createIssuesIndexesMigration: Migration = {
  id: '001-issues-create-indexes',
  description: 'Create indexes for stock issues',
  up: async () => {
    await StockIssueModel.createIndexes();
  },
};
