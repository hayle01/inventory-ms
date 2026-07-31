import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  RateLimitedError,
} from '../../src/shared/http/errors.js';

describe('AppError hierarchy', () => {
  it('assigns the expected status code and error code for each subclass', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new ForbiddenError().code).toBe('FORBIDDEN');
    expect(new ConflictError().statusCode).toBe(409);
    expect(new RateLimitedError(30).statusCode).toBe(429);
    expect(new RateLimitedError(30).retryAfterSeconds).toBe(30);
  });

  it('never leaks a details object unless explicitly provided', () => {
    const error = new AppError(500, 'INTERNAL_ERROR', 'safe message');
    expect(error.details).toBeUndefined();
  });
});
