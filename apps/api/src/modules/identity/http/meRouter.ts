import { Router } from 'express';
import { Types } from 'mongoose';
import { changePasswordRequestSchema, type SessionDto } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection, generateToken } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { UserModel } from '../models/User.js';
import * as AuthService from '../application/AuthService.js';
import { listActiveSessions, revokeSessionById } from '../application/SessionService.js';
import { toUserDto } from './mappers.js';

export const meRouter: Router = Router();

meRouter.use(requireAuth);

meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const user = await UserModel.findById(auth.userId).lean();
    if (!user) throw new NotFoundError('User not found.');
    sendSuccess(res, { user: toUserDto(user), permissions: auth.permissions });
  }),
);

meRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const sessions = await listActiveSessions(auth.userId);
    const dtos: SessionDto[] = sessions.map((session) => ({
      id: session._id.toString(),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: session._id.equals(auth.authSessionId),
      userAgentSummary: session.userAgentSummary ?? null,
    }));
    sendSuccess(res, dtos);
  }),
);

meRouter.delete(
  '/sessions/:sessionId',
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    let sessionId: Types.ObjectId;
    try {
      sessionId = new Types.ObjectId(req.params['sessionId']);
    } catch {
      throw new ValidationError('Invalid session id.');
    }
    const revoked = await revokeSessionById(auth.userId, sessionId, 'user_revoked');
    if (!revoked) throw new NotFoundError('Session not found.');
    sendSuccess(res, { revoked: true });
  }),
);

meRouter.patch(
  '/password',
  doubleCsrfProtection,
  validateBody(changePasswordRequestSchema),
  asyncHandler(async (req, res) => {
    getAuthContext(req);
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await AuthService.changePassword(req, currentPassword, newPassword, req.correlationId);
    // changePassword also rotates the session; issue a matching fresh CSRF
    // token (overwrite: true -- see authRouter.ts for why).
    const csrfToken = generateToken(req, res, true);
    sendSuccess(res, { changed: true, csrfToken });
  }),
);
