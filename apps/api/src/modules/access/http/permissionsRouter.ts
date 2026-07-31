import { Router } from 'express';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { PERMISSION_CATALOG } from '../domain/permissionCatalog.js';

export const permissionsRouter: Router = Router();

permissionsRouter.use(requireAuth);

permissionsRouter.get(
  '/',
  requirePermission('permissions.view'),
  asyncHandler((req, res) => {
    sendSuccess(res, PERMISSION_CATALOG);
    return Promise.resolve();
  }),
);
