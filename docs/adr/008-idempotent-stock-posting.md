# ADR-008: Idempotent stock posting

## Status

Accepted

## Context

Network retries, double-clicks, and job re-delivery must never produce a duplicate stock
movement.

## Decision

Every posting endpoint (and retried background job) requires an `Idempotency-Key` header. The
`idempotencyRecords` collection stores scope, key hash, request fingerprint, status, and the
safe response body, with a unique index on scope + key. Reusing a key with a different request
fingerprint returns `409`; a successful replay returns the original result without a second
stock movement.

## Consequences

- Idempotency registration happens inside the same MongoDB transaction as the ledger/balance
  writes, not as a separate best-effort step.
- Client-side mutation disabling (double-submit prevention) is a UX nicety, not a substitute for
  server-side idempotency.
- Every posting workflow's test suite includes an idempotency replay test and a
  different-payload-same-key conflict test (`SYSTEM_DOCUMENTATION.md` section 15.5, items 8-9).
