import type { ErrorCode } from '@inventory-ms/contracts';

/**
 * Base class for all safe, client-facing errors. The message is shown to
 * clients as-is, so it must never contain stack traces, Mongo queries,
 * internal paths, or secrets. Anything unexpected is wrapped as a generic
 * 500 by the error handler instead of leaking `error.message`.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(401, 'UNAUTHENTICATED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request failed validation.', details?: Record<string, unknown>) {
    super(422, 'VALIDATION_FAILED', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'The request conflicts with the current state.',
    details?: Record<string, unknown>,
  ) {
    super(409, 'CONFLICT', message, details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(422, 'BUSINESS_RULE_VIOLATION', message, details);
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class IdempotencyKeyRequiredError extends AppError {
  constructor(message = 'An Idempotency-Key header is required for this operation.') {
    super(400, 'IDEMPOTENCY_KEY_REQUIRED', message);
  }
}

export class IdempotencyKeyConflictError extends AppError {
  constructor(message = 'This Idempotency-Key was already used with a different request.') {
    super(409, 'IDEMPOTENCY_KEY_CONFLICT', message);
  }
}
