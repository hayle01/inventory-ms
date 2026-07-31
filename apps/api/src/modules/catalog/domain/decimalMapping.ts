import { Types } from 'mongoose';

/**
 * Converts between the API's decimal-string contract and MongoDB's
 * Decimal128 storage type. Never round-trip through `Number`/`parseFloat`.
 */
export function toDecimal128(value: string): Types.Decimal128 {
  return Types.Decimal128.fromString(value);
}

export function toDecimal128OrNull(value: string | null | undefined): Types.Decimal128 | null {
  return value === null || value === undefined ? null : toDecimal128(value);
}

export function decimal128ToString(value: Types.Decimal128): string {
  return value.toString();
}

export function decimal128ToStringOrNull(
  value: Types.Decimal128 | null | undefined,
): string | null {
  return value === null || value === undefined ? null : value.toString();
}
