import { Router } from 'express';
import {
  expiryReportQuerySchema,
  inventoryReportQuerySchema,
  issuesReportQuerySchema,
  lowStockReportQuerySchema,
  purchasesReportQuerySchema,
  stockMovementReportQuerySchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateQuery } from '../../../shared/http/validate.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { rateLimit } from '../../../shared/security/rateLimit.js';
import { rateLimitPolicies } from '../../../config.js';
import * as ReportService from '../application/ReportService.js';

export const reportsRouter: Router = Router();

reportsRouter.use(requireAuth);
reportsRouter.use(
  rateLimit(
    'generalApi',
    rateLimitPolicies.generalApi,
    (req) => req.authContext?.userId.toString() ?? 'anonymous',
  ),
);

reportsRouter.get(
  '/inventory',
  requirePermission('reports.view'),
  validateQuery(inventoryReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<(typeof inventoryReportQuerySchema)['parse']>;
    const report = await ReportService.getInventoryReport(getAuthContext(req).organizationId, query);
    sendSuccess(res, report);
  }),
);

reportsRouter.get(
  '/stock-movement',
  requirePermission('reports.view'),
  validateQuery(stockMovementReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<
      (typeof stockMovementReportQuerySchema)['parse']
    >;
    const report = await ReportService.getStockMovementReport(
      getAuthContext(req).organizationId,
      query,
    );
    sendSuccess(res, report);
  }),
);

reportsRouter.get(
  '/purchases',
  requirePermission('reports.view'),
  validateQuery(purchasesReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<(typeof purchasesReportQuerySchema)['parse']>;
    const report = await ReportService.getPurchasesReport(getAuthContext(req).organizationId, query);
    sendSuccess(res, report);
  }),
);

reportsRouter.get(
  '/issues',
  requirePermission('reports.view'),
  validateQuery(issuesReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<(typeof issuesReportQuerySchema)['parse']>;
    const report = await ReportService.getIssuesReport(getAuthContext(req).organizationId, query);
    sendSuccess(res, report);
  }),
);

reportsRouter.get(
  '/low-stock',
  requirePermission('reports.view'),
  validateQuery(lowStockReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<(typeof lowStockReportQuerySchema)['parse']>;
    const report = await ReportService.getLowStockReport(getAuthContext(req).organizationId, query);
    sendSuccess(res, report);
  }),
);

reportsRouter.get(
  '/expiry',
  requirePermission('reports.view'),
  validateQuery(expiryReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<(typeof expiryReportQuerySchema)['parse']>;
    const report = await ReportService.getExpiryReport(getAuthContext(req).organizationId, query);
    sendSuccess(res, report);
  }),
);
