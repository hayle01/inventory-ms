import { Decimal } from 'decimal.js';
import { z } from 'zod';

/**
 * Decimal values cross the API boundary as strings, never as `number`.
 * `Decimal` (decimal.js) is the only allowed arithmetic path in application
 * code; storage uses BSON Decimal128. Never use `Number`/`parseFloat` on
 * quantity or money fields.
 */
const DECIMAL_STRING_PATTERN = /^-?\d+(\.\d+)?$/;

export const decimalStringSchema = z
  .string()
  .trim()
  .regex(DECIMAL_STRING_PATTERN, 'Must be a decimal string, e.g. "12.5000"')
  .refine((value) => !Number.isNaN(new Decimal(value).toNumber()), {
    message: 'Must be a valid decimal',
  });

export const nonNegativeDecimalStringSchema = decimalStringSchema.refine(
  (value) => new Decimal(value).greaterThanOrEqualTo(0),
  { message: 'Must not be negative' },
);

export const positiveDecimalStringSchema = decimalStringSchema.refine(
  (value) => new Decimal(value).greaterThan(0),
  { message: 'Must be greater than zero' },
);

export function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

export function decimalToString(value: Decimal, decimalPlaces: number): string {
  return value.toFixed(decimalPlaces);
}

export { Decimal };
