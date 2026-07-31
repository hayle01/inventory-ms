import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../observability/logger.js';
import { AppError, RateLimitedError } from './errors.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested route was not found.',
      correlationId: req.correlationId,
    },
  });
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const correlationId = req.correlationId;

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request failed validation.',
        details: {
          fields: err.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        correlationId,
      },
    });
    return;
  }

  if (err instanceof RateLimitedError) {
    res.setHeader('Retry-After', String(err.retryAfterSeconds));
    res.status(429).json({
      error: { code: err.code, message: err.message, correlationId },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, correlationId }, 'Unhandled application error');
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        correlationId,
      },
    });
    return;
  }

  // Third-party middleware (e.g. csrf-csrf) throws http-errors-style objects
  // with a numeric statusCode and an `expose` flag marking the message safe.
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'expose' in err &&
    (err as { expose: unknown }).expose === true
  ) {
    const statusCode = (err as { statusCode: unknown }).statusCode;
    const message = err instanceof Error ? err.message : 'Request rejected.';
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      res.status(statusCode).json({
        error: {
          code:
            statusCode === 403
              ? 'FORBIDDEN'
              : statusCode === 401
                ? 'UNAUTHENTICATED'
                : 'VALIDATION_FAILED',
          message,
          correlationId,
        },
      });
      return;
    }
  }

  logger.error({ err, correlationId }, 'Unexpected error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      correlationId,
    },
  });
};
