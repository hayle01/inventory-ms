import type { RequestHandler } from 'express';
import type { Permission } from '@inventory-ms/contracts';
import { ForbiddenError, UnauthenticatedError } from '../http/errors.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { recordAuditEvent } from '../../modules/audit/application/AuditService.js';

/**
 * Requires `requireAuth` to run first. Denies with `403` and records an
 * audit event when the resolved permission set does not include the
 * required permission -- every denied path must be auditable, not just
 * successful ones.
 */
export function requirePermission(permission: Permission): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!req.authContext) throw new UnauthenticatedError();

    if (!req.authContext.permissions.includes(permission)) {
      await recordAuditEvent({
        organizationId: req.authContext.organizationId,
        actorId: req.authContext.userId,
        action: 'authorization.denied',
        resourceType: 'route',
        outcome: 'denied',
        permissionUsed: permission,
        correlationId: req.correlationId,
      });
      throw new ForbiddenError();
    }

    next();
  });
}
