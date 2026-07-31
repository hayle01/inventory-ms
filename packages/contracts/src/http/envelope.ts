import { z } from 'zod';

export const responseMetaSchema = z.object({
  correlationId: z.string().min(1),
});

export const paginatedMetaSchema = responseMetaSchema.extend({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  hasNext: z.boolean(),
});

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    correlationId: z.string().min(1),
  }),
});

export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type PaginatedMeta = z.infer<typeof paginatedMetaSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginatedMeta;
}

/** Field-level validation error shape used inside `error.details.fields`. */
export interface ValidationFieldError {
  field: string;
  message: string;
}

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'BUSINESS_RULE_VIOLATION',
  'RATE_LIMITED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_CONFLICT',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
