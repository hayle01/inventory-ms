import pino from 'pino';
import { env } from './config.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: `${env.APP_NAME}-worker`, env: env.NODE_ENV },
  redact: {
    paths: ['*.password', '*.token', '*.secret', '*.sessionId'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
