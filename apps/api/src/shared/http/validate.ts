import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/** Parses and replaces `req.body` with the validated result; ZodError propagates to errorHandler. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
  };
}
