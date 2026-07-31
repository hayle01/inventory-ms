import { Router } from 'express';
import { updateOrganizationRequestSchema } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import * as OrganizationService from '../application/OrganizationService.js';
import { toOrganizationDto } from './mappers.js';

export const organizationRouter: Router = Router();

organizationRouter.use(requireAuth);

organizationRouter.get(
  '/',
  requirePermission('organizations.view'),
  asyncHandler(async (req, res) => {
    const org = await OrganizationService.getOrganization(getAuthContext(req).organizationId);
    sendSuccess(res, toOrganizationDto(org));
  }),
);

organizationRouter.patch(
  '/',
  requirePermission('organizations.manage'),
  doubleCsrfProtection,
  validateBody(updateOrganizationRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const org = await OrganizationService.updateOrganization(
      auth.organizationId,
      auth.userId,
      req.correlationId,
      req.body as Parameters<typeof OrganizationService.updateOrganization>[3],
    );
    sendSuccess(res, toOrganizationDto(org));
  }),
);
