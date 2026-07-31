import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T documents the response payload shape at each call site
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    data,
    meta: { correlationId: res.req.correlationId },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T documents the response payload shape at each call site
export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: { page: number; perPage: number; total: number },
): void {
  res.status(200).json({
    data,
    meta: {
      correlationId: res.req.correlationId,
      page: page.page,
      perPage: page.perPage,
      total: page.total,
      hasNext: page.page * page.perPage < page.total,
    },
  });
}
