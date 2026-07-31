import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { UnauthenticatedError } from '../http/errors.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { UserModel } from '../../modules/identity/models/User.js';
import { AuthSessionModel } from '../../modules/identity/models/AuthSession.js';
import { touchSession } from '../../modules/identity/application/SessionService.js';
import { resolveEffectivePermissions } from '../../modules/identity/application/PermissionResolver.js';

/**
 * Validates the session cookie AND cross-checks the durable `authSessions`
 * record so a revoked session (logout-all, password reset, per-session
 * revoke) is rejected even if the Redis-backed express-session cookie is
 * still technically valid.
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const { userId, organizationId, authSessionId, mfaLevel } = req.session;
  if (!userId || !organizationId || !authSessionId) {
    throw new UnauthenticatedError();
  }

  const authSessionObjectId = new Types.ObjectId(authSessionId);
  const authSession = await AuthSessionModel.findOne({
    _id: authSessionObjectId,
    revokedAt: null,
    absoluteExpiresAt: { $gt: new Date() },
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!authSession)
    throw new UnauthenticatedError('Your session has expired. Please sign in again.');

  const user = await UserModel.findOne({
    _id: new Types.ObjectId(userId),
    status: 'active',
  }).lean();
  if (!user) throw new UnauthenticatedError();

  const permissions = await resolveEffectivePermissions(
    user.organizationId,
    user.roleIds,
    user.directPermissionNames,
  );

  req.authContext = {
    userId: user._id,
    organizationId: user.organizationId,
    permissions,
    mfaLevel: mfaLevel ?? 'none',
    authSessionId: authSessionObjectId,
  };

  void touchSession(authSessionObjectId);

  next();
});
