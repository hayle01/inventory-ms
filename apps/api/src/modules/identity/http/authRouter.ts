import { createHash } from 'node:crypto';
import { Router } from 'express';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  mfaVerifyRequestSchema,
  resetPasswordRequestSchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { rateLimit, clientIp } from '../../../shared/security/rateLimit.js';
import { generateToken, doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { rateLimitPolicies } from '../../../config.js';
import * as AuthService from '../application/AuthService.js';
import { toUserDto } from './mappers.js';

export const authRouter: Router = Router();

authRouter.get('/csrf-token', (req, res) => {
  // `overwrite: true` -- this endpoint's only job is to hand back a fresh,
  // valid token. Without it, csrf-csrf tries to validate any existing
  // cookie first and *throws* if that fails (e.g. a stale cookie left over
  // from a secret rotation), turning a "give me a token" endpoint into one
  // that can itself return 403.
  const csrfToken = generateToken(req, res, true);
  sendSuccess(res, { csrfToken });
});

const loginLimiterByIp = rateLimit('login', rateLimitPolicies.login, clientIp);
const loginLimiterByAccount = rateLimit('login', rateLimitPolicies.login, (req) => {
  const body = req.body as { usernameOrEmail?: string };
  return `account:${(body.usernameOrEmail ?? '').trim().toLowerCase()}`;
});

authRouter.post(
  '/login',
  doubleCsrfProtection,
  loginLimiterByIp,
  loginLimiterByAccount,
  validateBody(loginRequestSchema),
  asyncHandler(async (req, res) => {
    const { usernameOrEmail, password } = req.body as { usernameOrEmail: string; password: string };
    const result = await AuthService.login(req, usernameOrEmail, password, req.correlationId);

    if (result.status === 'mfa_required' || !result.user) {
      sendSuccess(res, { mfaRequired: true, challengeId: result.challengeId });
      return;
    }

    // Login rotates the session ID (fixation protection); the CSRF token is
    // bound to the session ID, so the client needs a fresh one to make any
    // further state-changing request (e.g. logout) without a 403.
    // `overwrite: true` -- always mint a new one rather than trying (and
    // possibly failing) to validate whatever cookie is already present.
    const csrfToken = generateToken(req, res, true);
    sendSuccess(res, { user: toUserDto(result.user), permissions: result.permissions, csrfToken });
  }),
);

const mfaLimiter = rateLimit('mfaVerify', rateLimitPolicies.mfaVerify, (req) => {
  const body = req.body as { challengeId?: string };
  return body.challengeId ?? clientIp(req);
});

authRouter.post(
  '/mfa/verify',
  doubleCsrfProtection,
  mfaLimiter,
  validateBody(mfaVerifyRequestSchema),
  asyncHandler(async (req, res) => {
    const { challengeId, code } = req.body as { challengeId: string; code: string };
    const { user, permissions } = await AuthService.verifyMfa(
      req,
      challengeId,
      code,
      req.correlationId,
    );
    const csrfToken = generateToken(req, res, true);
    sendSuccess(res, { user: toUserDto(user), permissions, csrfToken });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    await AuthService.logout(req, req.correlationId);
    sendSuccess(res, { loggedOut: true });
  }),
);

authRouter.post(
  '/logout-all',
  requireAuth,
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    await AuthService.logoutAll(req, req.correlationId);
    sendSuccess(res, { loggedOut: true });
  }),
);

const forgotPasswordLimiterByIp = rateLimit(
  'forgotPassword',
  rateLimitPolicies.forgotPassword,
  clientIp,
);
const forgotPasswordLimiterByDestination = rateLimit(
  'forgotPassword',
  rateLimitPolicies.forgotPassword,
  (req) => {
    const body = req.body as { usernameOrEmail?: string };
    return createHash('sha256')
      .update((body.usernameOrEmail ?? '').trim().toLowerCase())
      .digest('hex');
  },
);

authRouter.post(
  '/forgot-password',
  doubleCsrfProtection,
  forgotPasswordLimiterByIp,
  forgotPasswordLimiterByDestination,
  validateBody(forgotPasswordRequestSchema),
  asyncHandler(async (req, res) => {
    const { usernameOrEmail } = req.body as { usernameOrEmail: string };
    const result = await AuthService.forgotPassword(usernameOrEmail, req, req.correlationId);
    sendSuccess(res, result);
  }),
);

authRouter.post(
  '/reset-password',
  doubleCsrfProtection,
  validateBody(resetPasswordRequestSchema),
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    await AuthService.resetPassword(token, newPassword, req.correlationId);
    sendSuccess(res, { reset: true });
  }),
);
