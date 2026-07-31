# ADR-001: MERN modular monolith

## Status

Accepted

## Context

The system has one product and one deployment boundary. Receiving, issuing, adjustment,
transfer, balances, alerts, and audit share strong cross-cutting transaction requirements that
are simplest to guarantee inside a single MongoDB deployment and a single service process.

## Decision

Build a TypeScript pnpm-workspace monorepo (`apps/web`, `apps/api`, `apps/worker`,
`packages/*`) with the API structured as a modular monolith. Modules under
`apps/api/src/modules/*` own their own models, application services, and HTTP routes. A module
must not import another module's MongoDB model directly; cross-module work goes through
exported application services or explicit domain contracts.

## Consequences

- Simpler multi-document transactions than a microservices split would allow.
- Module boundaries are enforced by convention and code review, not process isolation.
- Microservice extraction is deferred until a proven scaling or ownership need cannot be solved
  within the modular monolith (see `SYSTEM_DOCUMENTATION.md` section 6.1).
