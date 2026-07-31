import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { env } from '../../../config.js';
import { AuthSessionModel, type AuthSessionDoc } from '../models/AuthSession.js';
import type { UserDoc } from '../models/User.js';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error('Session store operation failed', { cause: err });
}

function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

function hashIp(ip: string | undefined): string | null {
  return ip ? createHash('sha256').update(ip).digest('hex') : null;
}

function summarizeUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, 200);
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err: unknown) => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: unknown) => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err: unknown) => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

/**
 * Establishes a fresh, rotated session after login/MFA completion. Session
 * ID rotation prevents session fixation; the opaque ID never leaves the
 * `HttpOnly` cookie, and only its hash is persisted in `authSessions`.
 */
export async function establishSession(
  req: Request,
  user: Pick<UserDoc, '_id' | 'organizationId'>,
  mfaLevel: 'none' | 'verified',
): Promise<void> {
  await regenerateSession(req);

  const now = new Date();
  const idleMs = env.SESSION_IDLE_MINUTES * 60 * 1000;
  const absoluteMs = env.SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000;

  const authSession = await AuthSessionModel.create({
    userId: user._id,
    organizationId: user.organizationId,
    sessionIdHash: hashSessionId(`${req.sessionID}:${randomBytes(8).toString('hex')}`),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + idleMs),
    absoluteExpiresAt: new Date(now.getTime() + absoluteMs),
    ipHash: hashIp(req.ip),
    userAgentSummary: summarizeUserAgent(req.headers['user-agent']),
    mfaLevel,
  });

  req.session.userId = user._id.toString();
  req.session.organizationId = user.organizationId.toString();
  req.session.authSessionId = authSession._id.toString();
  req.session.mfaLevel = mfaLevel;

  await saveSession(req);
}

export async function endCurrentSession(req: Request, reason: string): Promise<void> {
  const authSessionId = req.session.authSessionId;
  if (authSessionId) {
    await AuthSessionModel.updateOne(
      { _id: new Types.ObjectId(authSessionId), revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
    );
  }
  await destroySession(req);
}

export async function revokeAllSessions(userId: Types.ObjectId, reason: string): Promise<void> {
  await AuthSessionModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } },
  );
}

export async function revokeSessionById(
  userId: Types.ObjectId,
  authSessionId: Types.ObjectId,
  reason: string,
): Promise<boolean> {
  const result = await AuthSessionModel.updateOne(
    { _id: authSessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } },
  );
  return result.modifiedCount > 0;
}

export async function listActiveSessions(userId: Types.ObjectId): Promise<AuthSessionDoc[]> {
  return AuthSessionModel.find({
    userId,
    revokedAt: null,
    absoluteExpiresAt: { $gt: new Date() },
  })
    .sort({ lastSeenAt: -1 })
    .lean();
}

export async function touchSession(authSessionId: Types.ObjectId): Promise<void> {
  const now = new Date();
  await AuthSessionModel.updateOne(
    { _id: authSessionId },
    {
      $set: {
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + env.SESSION_IDLE_MINUTES * 60 * 1000),
      },
    },
  );
}
