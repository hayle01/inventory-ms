import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Builds a Zod schema for a sort query param restricted to an allow-list of
 * field names, e.g. `sort=name` or `sort=-createdAt` for descending.
 */
export function sortQuerySchema(allowedFields: readonly [string, ...string[]]) {
  const pattern = new RegExp(`^-?(${allowedFields.join('|')})$`);
  return z
    .string()
    .regex(pattern, `sort must be one of: ${allowedFields.join(', ')} (prefix with - for desc)`)
    .optional();
}
