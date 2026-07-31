import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { Permission } from '@inventory-ms/contracts';
import { UnauthenticatedError } from '../http/errors.js';

export interface AuthContext {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  permissions: readonly Permission[];
  mfaLevel: 'none' | 'verified';
  authSessionId: Types.ObjectId;
}

declare module 'express-serve-static-core' {
  interface Request {
    authContext?: AuthContext;
  }
}

/** `requireAuth` must run before any handler that calls this; throws otherwise. */
export function getAuthContext(req: Request): AuthContext {
  if (!req.authContext) throw new UnauthenticatedError();
  return req.authContext;
}
