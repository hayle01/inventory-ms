import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    organizationId?: string;
    authSessionId?: string;
    mfaLevel?: 'none' | 'verified';
  }
}
