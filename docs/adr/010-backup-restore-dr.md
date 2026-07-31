# ADR-010: Backup, restore, and disaster-recovery targets

## Status

Accepted (targets pending business sign-off -- see `SYSTEM_DOCUMENTATION.md` section 20, item 14)

## Context

Inventory and financial history must survive infrastructure failure, and restores must be
provably correct, not just assumed to work.

## Decision

Production MongoDB uses automated daily full backups or managed snapshots with point-in-time
recovery, encrypted separately from the live database, with daily/weekly/monthly retention.
Backup success/failure is monitored (`jobRuns`/`backupRuns` collections, `operations` module),
and restores are regularly rehearsed into an isolated environment with a post-restore
ledger/balance integrity check. Backup credentials cannot modify the live application database.

## Consequences

- RPO/RTO numbers are a business decision to be confirmed before the Phase 8 (Operations and
  Hardening) release gate -- example planning targets (one-hour RPO, four-hour RTO) are not
  assumed requirements until approved.
- Release gates block shipping without a demonstrated restore procedure
  (`SYSTEM_DOCUMENTATION.md` section 19).
