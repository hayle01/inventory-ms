# ADR-003: Replica-set transactions and conditional balance updates

## Status

Accepted

## Context

Posting a receipt or issue must atomically update the source document, ledger, balance
projection, reservations, idempotency record, and audit event. MongoDB only supports
multi-document ACID transactions on a replica set (or compatible managed cluster), never on a
standalone instance.

## Decision

- Local, test, staging, and production MongoDB always run as a replica set
  (`infra/docker/compose` runs a single-node `rs0` for local/dev/CI; managed deployments use a
  real multi-node replica set or sharded cluster with transaction support).
- All multi-document writes go through `withTransaction()`
  (`apps/api/src/shared/infrastructure/mongo.ts`), which wraps `session.withTransaction` with
  majority write concern, snapshot read concern, and bounded retry of only recognized transient
  transaction / unknown-commit-result errors.
- Operations inside a transaction run sequentially -- never `Promise.all` -- and never call
  external services (email, SMS, object storage, PDF generation).
- Stock decrements use conditional predicates (`findOneAndUpdate` with an availability +
  version guard) so a failed predicate is treated as a business conflict (`409`/`422`), never a
  partial write.

## Consequences

- Integration tests must run against a real replica set (see `pnpm docker:up`); mocks and
  standalone MongoDB cannot prove this behavior and are forbidden for these tests.
- Transactions must stay short to avoid contention; long-running or external work is queued
  after commit (see ADR-009).
