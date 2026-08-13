import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { env } from '../../../config.js';
import { accountLockoutPolicy } from '../../../config.js';
import { UnauthenticatedError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { enqueueNotification } from '../../../shared/infrastructure/queue.js';
import { UserModel, type UserDoc } from '../models/User.js';
import { PasswordResetTokenModel } from '../models/PasswordResetToken.js';
import { hashPassword, verifyPassword } from '../domain/password.js';
import { verifyTotpToken, decryptMfaSecret, hashRecoveryCode } from '../domain/mfa.js';
import { establishSession, endCurrentSession, revokeAllSessions } from './SessionService.js';
import { createMfaChallenge, consumeMfaChallenge } from './MfaChallengeStore.js';
import { resolveEffectivePermissions } from './PermissionResolver.js';

const GENERIC_LOGIN_ERROR = 'Invalid username/email or password.';
const GENERIC_RESET_MESSAGE =
  'If an account matches that username or email, password reset instructions have been sent.';
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function ipHash(ip: string | undefined): string | null {
  return ip ? createHash('sha256').update(ip).digest('hex') : null;
}

export interface LoginResult {
  status: 'authenticated' | 'mfa_required';
  challengeId?: string;
  user?: UserDoc;
  permissions?: string[];
}

export async function login(
  req: Request,
  usernameOrEmail: string,
  password: string,
  correlationId: string,
): Promise<LoginResult> {
  const normalized = usernameOrEmail.trim().toLowerCase();
  const user = await UserModel.findOne({
    $or: [{ usernameNormalized: normalized }, { emailNormalized: normalized }],
  }).select('+passwordHash');

  if (!user) {
    // No organization to scope an audit event to for an unknown identifier;
    // rate limiting on this route is the control against enumeration/brute force.
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }

  if (user.status === 'locked' && user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAuditEvent({
      organizationId: user.organizationId,
      actorId: user._id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user._id,
      outcome: 'denied',
      reason: 'account_locked',
      correlationId,
    });
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= accountLockoutPolicy.failureThreshold) {
      user.status = 'locked';
      user.lockedUntil = new Date(Date.now() + accountLockoutPolicy.lockoutMinutes * 60 * 1000);
    }
    await user.save();
    await recordAuditEvent({
      organizationId: user.organizationId,
      actorId: user._id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user._id,
      outcome: 'denied',
      reason: 'invalid_password',
      correlationId,
    });
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }

  if (user.status === 'invited') {
    user.status = 'active';
  } else if (user.status !== 'active') {
    await recordAuditEvent({
      organizationId: user.organizationId,
      actorId: user._id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user._id,
      outcome: 'denied',
      reason: 'account_not_active',
      correlationId,
    });
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }

  user.failedLoginCount = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  if (user.mfa.enabled) {
    const challengeId = await createMfaChallenge(user._id.toString());
    await recordAuditEvent({
      organizationId: user.organizationId,
      actorId: user._id,
      action: 'auth.login.mfa_challenge',
      resourceType: 'user',
      resourceId: user._id,
      outcome: 'success',
      correlationId,
    });
    return { status: 'mfa_required', challengeId };
  }

  await establishSession(req, user, 'none');
  const permissions = await resolveEffectivePermissions(
    user.organizationId,
    user.roleIds,
    user.directPermissionNames,
  );

  await recordAuditEvent({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId,
    ipHash: ipHash(req.ip),
  });

  return { status: 'authenticated', user: user.toObject(), permissions };
}

export async function verifyMfa(
  req: Request,
  challengeId: string,
  code: string,
  correlationId: string,
): Promise<{ user: UserDoc; permissions: string[] }> {
  const userId = await consumeMfaChallenge(challengeId);
  if (!userId)
    throw new UnauthenticatedError('This MFA challenge has expired. Please sign in again.');

  const user = await UserModel.findById(userId);
  if (!user || !user.mfa.enabled || !user.mfa.secretCiphertext) {
    throw new UnauthenticatedError('This MFA challenge has expired. Please sign in again.');
  }

  const secret = decryptMfaSecret(user.mfa.secretCiphertext);
  const validTotp = verifyTotpToken(secret, code);
  const recoveryHash = hashRecoveryCode(code);
  const recoveryIndex = user.mfa.recoveryCodeHashes.indexOf(recoveryHash);
  const validRecovery = recoveryIndex !== -1;

  if (!validTotp && !validRecovery) {
    await recordAuditEvent({
      organizationId: user.organizationId,
      actorId: user._id,
      action: 'auth.mfa.verify',
      resourceType: 'user',
      resourceId: user._id,
      outcome: 'denied',
      correlationId,
    });
    throw new UnauthenticatedError('The verification code is invalid or expired.');
  }

  if (validRecovery) {
    user.mfa.recoveryCodeHashes.splice(recoveryIndex, 1);
    await user.save();
  }

  await establishSession(req, user, 'verified');
  const permissions = await resolveEffectivePermissions(
    user.organizationId,
    user.roleIds,
    user.directPermissionNames,
  );

  await recordAuditEvent({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'auth.mfa.verify',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId,
  });

  return { user: user.toObject(), permissions };
}

export async function logout(req: Request, correlationId: string): Promise<void> {
  const userId = req.session.userId;
  const organizationId = req.session.organizationId;
  await endCurrentSession(req, 'user_logout');
  if (userId && organizationId) {
    await recordAuditEvent({
      organizationId: new Types.ObjectId(organizationId),
      actorId: new Types.ObjectId(userId),
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: new Types.ObjectId(userId),
      outcome: 'success',
      correlationId,
    });
  }
}

export async function logoutAll(req: Request, correlationId: string): Promise<void> {
  const userId = req.session.userId;
  const organizationId = req.session.organizationId;
  if (userId) await revokeAllSessions(new Types.ObjectId(userId), 'logout_all');
  await endCurrentSession(req, 'logout_all');
  if (userId && organizationId) {
    await recordAuditEvent({
      organizationId: new Types.ObjectId(organizationId),
      actorId: new Types.ObjectId(userId),
      action: 'auth.logout_all',
      resourceType: 'user',
      resourceId: new Types.ObjectId(userId),
      outcome: 'success',
      correlationId,
    });
  }
}

export interface ForgotPasswordResult {
  message: string;
  /**
   * Always returned, whether or not the account exists -- a random,
   * unresolvable id when it doesn't, so the response shape never reveals
   * account existence. Used to call verifyResetCode().
   */
  challengeId: string;
  devResetCode?: string;
}

function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function forgotPassword(
  usernameOrEmail: string,
  req: Request,
  correlationId: string,
): Promise<ForgotPasswordResult> {
  const normalized = usernameOrEmail.trim().toLowerCase();
  const user = await UserModel.findOne({
    $or: [{ usernameNormalized: normalized }, { emailNormalized: normalized }],
    status: { $in: ['active', 'invited'] },
  });

  if (user) {
    const code = generateResetCode();
    const codeHash = createHash('sha256').update(code).digest('hex');
    const challenge = await PasswordResetTokenModel.create({
      userId: user._id,
      codeHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      requestIpHash: ipHash(req.ip),
    });

    await enqueueNotification({
      template: 'password-reset',
      toUserId: user._id.toString(),
      data: { resetCode: code },
    });

    await recordAuditEvent({
      organizationId: user.organizationId,
      actorId: user._id,
      action: 'auth.forgot_password',
      resourceType: 'user',
      resourceId: user._id,
      outcome: 'success',
      correlationId,
    });

    return {
      message: GENERIC_RESET_MESSAGE,
      challengeId: challenge._id.toString(),
      ...(env.NODE_ENV !== 'production' ? { devResetCode: code } : {}),
    };
  }

  // No matching account -- still return a well-formed, unresolvable
  // challengeId so the response is indistinguishable from the real case.
  return { message: GENERIC_RESET_MESSAGE, challengeId: new Types.ObjectId().toString() };
}

const RESET_CODE_MAX_ATTEMPTS = 5;
const GENERIC_CODE_ERROR = 'Invalid or expired code.';

export async function verifyResetCode(
  challengeId: string,
  code: string,
  correlationId: string,
): Promise<{ token: string }> {
  const challenge = await PasswordResetTokenModel.findOne({
    _id: Types.ObjectId.isValid(challengeId) ? new Types.ObjectId(challengeId) : null,
    codeHash: { $ne: null },
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) throw new ValidationError(GENERIC_CODE_ERROR);

  challenge.codeAttempts += 1;
  const exceededAttempts = challenge.codeAttempts > RESET_CODE_MAX_ATTEMPTS;
  const codeHash = createHash('sha256').update(code).digest('hex');
  const matches = !exceededAttempts && challenge.codeHash === codeHash;

  if (!matches) {
    if (exceededAttempts) challenge.usedAt = new Date();
    await challenge.save();
    throw new ValidationError(GENERIC_CODE_ERROR);
  }

  challenge.usedAt = new Date();
  await challenge.save();

  const user = await UserModel.findById(challenge.userId);
  if (!user) throw new ValidationError(GENERIC_CODE_ERROR);

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await PasswordResetTokenModel.create({
    userId: challenge.userId,
    tokenHash,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  });

  await recordAuditEvent({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'auth.verify_reset_code',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId,
  });

  return { token: rawToken };
}

export async function resetPassword(
  token: string,
  newPassword: string,
  correlationId: string,
): Promise<void> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const resetToken = await PasswordResetTokenModel.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!resetToken) throw new ValidationError('This password reset link is invalid or has expired.');

  const user = await UserModel.findById(resetToken.userId);
  if (!user) throw new ValidationError('This password reset link is invalid or has expired.');

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  if (user.status === 'invited') user.status = 'active';
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  await revokeAllSessions(user._id, 'password_reset');

  await recordAuditEvent({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'auth.reset_password',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId,
  });
}

export async function changePassword(
  req: Request,
  currentPassword: string,
  newPassword: string,
  correlationId: string,
): Promise<void> {
  if (!req.authContext) throw new UnauthenticatedError();
  const user = await UserModel.findById(req.authContext.userId).select('+passwordHash');
  if (!user) throw new UnauthenticatedError();

  const validCurrent = await verifyPassword(user.passwordHash, currentPassword);
  if (!validCurrent) throw new ValidationError('Current password is incorrect.');

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();

  await revokeAllSessions(user._id, 'password_change');
  await establishSession(req, user, req.authContext.mfaLevel);

  await recordAuditEvent({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'auth.change_password',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId,
  });
}
