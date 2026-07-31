import pino from 'pino';
import { env } from '../../config.js';

/**
 * Structured JSON logger with automatic redaction of secrets, tokens,
 * cookies, and authorization headers. Never log passwords, MFA secrets,
 * session identifiers, or full request bodies.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    app: env.APP_NAME,
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.token',
      'req.body.code',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      '*.mfaSecret',
      '*.sessionId',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
