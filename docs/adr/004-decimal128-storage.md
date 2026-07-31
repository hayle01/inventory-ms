# ADR-004: Decimal128 storage and decimal-string API

## Status

Accepted

## Context

JavaScript's binary floating point cannot represent money and quantity values exactly, which is
unacceptable for inventory and financial accuracy.

## Decision

Quantities and money are stored as BSON `Decimal128` in MongoDB and cross the API boundary as
validated decimal strings (`packages/contracts/src/decimal.ts`). Application code performs all
arithmetic through `decimal.js` (`Decimal`). `Number`, `parseFloat`, and implicit numeric
coercion are forbidden for these fields anywhere in the codebase.

## Consequences

- Every DTO with a quantity/money field uses `decimalStringSchema` (or a stricter variant) from
  `@inventory-ms/contracts`, not `z.number()`.
- Frontend forms preserve decimal inputs as strings end-to-end (React Hook Form fields, not
  parsed into JS numbers) until the moment they need to render as text.
- Precision/rounding tests are part of the mandatory unit test suite (see
  `SYSTEM_DOCUMENTATION.md` section 15.1).
