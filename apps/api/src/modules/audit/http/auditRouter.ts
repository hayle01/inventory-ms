import { Router } from 'express';
import { auditEventsQuerySchema } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendPaginated } from '../../../shared/http/envelope.js';
import { validateQuery } from '../../../shared/http/validate.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { rateLimit } from '../../../shared/security/rateLimit.js';
import { rateLimitPolicies } from '../../../config.js';
import * as AuditService from '../application/AuditService.js';
import { toAuditEventDto } from './mappers.js';

export const auditRouter: Router = Router();

auditRouter.use(requireAuth);
auditRouter.use(
  rateLimit(
    'generalApi',
    rateLimitPolicies.generalApi,
    (req) => req.authContext?.userId.toString() ?? 'anonymous',
  ),
);

auditRouter.get(
  '/',
  requirePermission('audit.view'),
  validateQuery(auditEventsQuerySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const query = req.query as unknown as ReturnType<(typeof auditEventsQuerySchema)['parse']>;
    const { items, total } = await AuditService.listAuditEvents(auth.organizationId, query);
    sendPaginated(res, items.map(toAuditEventDto), {
      page: query.page,
      perPage: query.perPage,
      total,
    });
  }),
);
