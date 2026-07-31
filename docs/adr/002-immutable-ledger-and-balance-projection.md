# ADR-002: MongoDB immutable ledger and balance projection

## Status

Accepted

## Context

Inventory accuracy and auditability require that every stock change be traceable and that
history can never be silently altered.

## Decision

`stockTransactions` is the authoritative, append-only ledger. Every quantity change writes one
or more immutable `stockTransactions` documents. `stockBalances` is a derived, transactional
read projection keyed by `organizationId + warehouseId + locationId + productId + lotId-or-null
+ stockState` (unique compound index). `products.quantityInStock` never exists. Corrections use
linked reversal, return, or adjustment documents -- posted ledger facts are never edited or
deleted.

## Consequences

- Reconciliation jobs can prove `stockBalances` sums match `stockTransactions` sums per key.
- Reads of current stock always go through the balance projection, not the ledger, for
  performance; the ledger is queried for history/audit.
- Every posting workflow must maintain both the ledger and the projection in the same
  transaction (see ADR-003).
