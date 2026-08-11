import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { InventoryLotModel } from '../models/InventoryLot.js';
import { StockTransactionModel } from '../models/StockTransaction.js';
import { StockBalanceModel } from '../models/StockBalance.js';
import { IdempotencyResultModel } from '../../../shared/infrastructure/idempotency.js';

export const createInventoryIndexesMigration: Migration = {
  id: '001-inventory-create-indexes',
  description:
    'Create indexes for inventory lots, the stock ledger, stock balances, and the shared idempotency result store',
  up: async () => {
    await InventoryLotModel.createIndexes();
    await StockTransactionModel.createIndexes();
    await StockBalanceModel.createIndexes();
    await IdempotencyResultModel.createIndexes();
  },
};
