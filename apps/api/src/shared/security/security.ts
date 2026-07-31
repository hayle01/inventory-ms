import cors from 'cors';
import helmet from 'helmet';
import type { Express, NextFunction, Request, Response } from 'express';
import { env } from '../../config.js';

const REQUEST_TIMEOUT_MS = 15_000;
const JSON_BODY_LIMIT = '256kb';

export { JSON_BODY_LIMIT };

export function applyProxyTrust(app: Express): void {
  // Number of reverse-proxy hops to trust for X-Forwarded-* headers.
  app.set('trust proxy', env.TRUST_PROXY);
}

export function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    hsts: env.NODE_ENV === 'production' ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
}

export function corsMiddleware() {
  const allowList = new Set(env.CORS_ALLOWED_ORIGINS);
  return cors({
    origin(origin, callback) {
      if (!origin || allowList.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-CSRF-Token', 'X-Correlation-Id'],
  });
}

/** Aborts requests that run longer than the configured timeout with a safe response. */
export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The request timed out.',
          correlationId: req.correlationId,
        },
      });
    }
  });
  next();
}
