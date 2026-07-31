# ADR-007: Lot/expiry and FEFO/FIFO allocation

## Status

Accepted

## Context

Expiry-tracked inventory (e.g. medicines) must be issued oldest-expiry-first to minimize waste
and risk; non-expiry inventory should still rotate oldest-received-first.

## Decision

Products configured with `trackExpiry` require lot number and expiry date at receipt.
Allocation for issues selects eligible lots by expiry date then received date (FEFO) for
expiry-tracked products, and by received date (FIFO) otherwise. Expired, quarantined, or
damaged lots are excluded from allocation unless a separately authorized workflow changes their
state. Any authorized override of the allocation algorithm requires a reason and produces an
audit event.

## Consequences

- The allocation service is a pure domain function, independently unit-testable against
  synthetic lot sets (see `SYSTEM_DOCUMENTATION.md` section 15.1, ISS-04).
- Receiving without lot/expiry for an expiry-tracked product is a validation failure, not a
  silently accepted receipt.
