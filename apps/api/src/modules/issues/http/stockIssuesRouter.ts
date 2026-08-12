import { Router } from 'express';
import { Types } from 'mongoose';
import {
  cancelStockIssueRequestSchema,
  createStockIssueRequestSchema,
  reverseStockIssueRequestSchema,
  updateStockIssueRequestSchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { rateLimit } from '../../../shared/security/rateLimit.js';
import { rateLimitPolicies } from '../../../config.js';
import { IdempotencyKeyRequiredError, ValidationError } from '../../../shared/http/errors.js';
import * as IssueService from '../application/IssueService.js';
import { toStockIssueDto } from './mappers.js';

export const stockIssuesRouter: Router = Router();

stockIssuesRouter.use(requireAuth);
stockIssuesRouter.use(
  rateLimit(
    'generalApi',
    rateLimitPolicies.generalApi,
    (req) => req.authContext?.userId.toString() ?? 'anonymous',
  ),
);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

function requireIdempotencyKey(req: { header: (name: string) => string | undefined }): string {
  const key = req.header('Idempotency-Key');
  if (!key) throw new IdempotencyKeyRequiredError();
  return key;
}

const stockPostingLimiter = rateLimit(
  'stockPosting',
  rateLimitPolicies.stockPosting,
  (req) => req.authContext?.userId.toString() ?? 'anonymous',
);

stockIssuesRouter.get(
  '/',
  requirePermission('issues.view'),
  asyncHandler(async (req, res) => {
    const issues = await IssueService.listStockIssues(getAuthContext(req).organizationId);
    sendSuccess(res, issues.map(toStockIssueDto));
  }),
);

stockIssuesRouter.post(
  '/',
  requirePermission('issues.create'),
  doubleCsrfProtection,
  validateBody(createStockIssueRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockIssue = await IssueService.createStockIssue(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof IssueService.createStockIssue>[1],
    );
    sendSuccess(res, toStockIssueDto(stockIssue), 201);
  }),
);

stockIssuesRouter.get(
  '/:id',
  requirePermission('issues.view'),
  asyncHandler(async (req, res) => {
    const stockIssue = await IssueService.getStockIssueById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockIssueDto(stockIssue));
  }),
);

stockIssuesRouter.patch(
  '/:id',
  requirePermission('issues.update'),
  doubleCsrfProtection,
  validateBody(updateStockIssueRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockIssue = await IssueService.updateStockIssue(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof IssueService.updateStockIssue>[2],
    );
    sendSuccess(res, toStockIssueDto(stockIssue));
  }),
);

stockIssuesRouter.post(
  '/:id/pick',
  requirePermission('issues.pick'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockIssue = await IssueService.pickStockIssue(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockIssueDto(stockIssue));
  }),
);

stockIssuesRouter.post(
  '/:id/cancel',
  requirePermission('issues.update'),
  doubleCsrfProtection,
  validateBody(cancelStockIssueRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const stockIssue = await IssueService.cancelStockIssue(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toStockIssueDto(stockIssue));
  }),
);

stockIssuesRouter.post(
  '/:id/post',
  requirePermission('issues.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const stockIssue = await IssueService.postStockIssue(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toStockIssueDto(stockIssue));
  }),
);

stockIssuesRouter.post(
  '/:id/reverse',
  requirePermission('issues.reverse'),
  doubleCsrfProtection,
  stockPostingLimiter,
  validateBody(reverseStockIssueRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const { reason } = req.body as { reason: string };
    const stockIssue = await IssueService.reverseStockIssue(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
      idempotencyKey,
    );
    sendSuccess(res, toStockIssueDto(stockIssue));
  }),
);
