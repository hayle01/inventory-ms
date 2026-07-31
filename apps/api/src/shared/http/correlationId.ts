import type { NextFunction, Request, Response } from 'express';
import { ulid } from 'ulid';

const CORRELATION_HEADER = 'x-correlation-id';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_HEADER);
  const correlationId = incoming && incoming.length <= 128 ? incoming : ulid();
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_HEADER, correlationId);
  next();
}
