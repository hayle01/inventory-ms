# ADR-006: Granular RBAC and record-scope policy

## Status

Accepted

## Context

Access control must be auditable, configurable per organization, and never depend on
hard-coded role names that would make policy changes require a code deploy.

## Decision

Permissions are granular strings (`packages/contracts/src/permissions.ts`, the canonical list
mirrored from `SYSTEM_DOCUMENTATION.md` section 3.2). Roles are configurable bundles of
permissions stored in MongoDB, not enum values in code. Every protected action is checked, in
order: authenticated session, active user/org membership, required permission, organization
scope, department/warehouse/location/ownership scope, document status, separation-of-duty
policy, and MFA/re-authentication level when required. Controllers never branch on a role name.

## Consequences

- Adding or renaming a role never requires touching authorization middleware.
- Every permission-checked route has a corresponding denial test (unauthenticated and
  permission-denied) per `SYSTEM_DOCUMENTATION.md` section 15.2.
- The frontend's route guards are UX-only; the same checks are re-run server-side on every
  request.
