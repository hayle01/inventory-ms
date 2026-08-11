import { Router } from 'express';
import { inventoryQuerySchema } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateQuery } from '../../../shared/http/validate.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { StockBalanceModel } from '../models/StockBalance.js';
import { StockTransactionModel } from '../models/StockTransaction.js';
import { toStockBalanceDto, toStockTransactionDto } from './mappers.js';

export const inventoryRouter: Router = Router();

inventoryRouter.use(requireAuth);

/**
 * Read-only ledger and balance browsing. Only allow-listed filters
 * (`productId`, `warehouseId`) are ever passed to MongoDB -- never raw
 * `req.query`.
 */
inventoryRouter.get(
  '/balances',
  requirePermission('inventory.view'),
  validateQuery(inventoryQuerySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const query = req.query as unknown as ReturnType<(typeof inventoryQuerySchema)['parse']>;
    const filter: Record<string, unknown> = { organizationId: auth.organizationId };
    if (query.productId) filter['productId'] = query.productId;
    if (query.warehouseId) filter['warehouseId'] = query.warehouseId;

    const balances = await StockBalanceModel.find(filter).sort({ updatedAt: -1 }).limit(500).lean();
    sendSuccess(res, balances.map(toStockBalanceDto));
  }),
);

inventoryRouter.get(
  '/transactions',
  requirePermission('inventory.view'),
  validateQuery(inventoryQuerySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const query = req.query as unknown as ReturnType<(typeof inventoryQuerySchema)['parse']>;
    const filter: Record<string, unknown> = { organizationId: auth.organizationId };
    if (query.productId) filter['productId'] = query.productId;
    if (query.warehouseId) filter['warehouseId'] = query.warehouseId;

    const transactions = await StockTransactionModel.find(filter)
      .sort({ transactionAt: -1 })
      .limit(500)
      .lean();
    sendSuccess(res, transactions.map(toStockTransactionDto));
  }),
);
