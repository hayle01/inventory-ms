# Inventory Management System — Proposal Presentation Source

Source content for a pitch/proposal deck (built for feeding into Gamma or a similar deck generator). Each `##` section below is meant to become one slide, or a small cluster of 2–3 related slides where noted. Keep bullets short on the actual slides — this doc includes more explanatory text than a slide should carry, trim on generation.

---

## Title

**Inventory Management System**
A secure, ledger-based inventory platform for organizations that can't afford to get stock numbers wrong.

_[Subtitle]_ Built on the MERN stack, designed around financial-grade accounting principles applied to physical stock.

---

## The problem

- Most small-to-mid-size inventory tools track stock as a single mutable number per product: "quantity in stock." Every update overwrites the last one.
- That design has no memory. When the number is wrong, nobody can say *why* — was it a bad count, a missed return, a duplicate issue, a bug?
- No audit trail means no accountability. No transaction history means no trust in a report.
- Concurrent updates (two people issuing the same low-stock item at once) can silently oversell — the numbers just don't add up and nobody notices until a physical count.
- Manual reconciliation eats hours every cycle, and disputes ("who approved this adjustment?") have no paper trail to settle them.

---

## The solution

A system that treats every stock movement the way accounting software treats every financial transaction: **immutable, attributable, and reversible — never overwritten.**

- Every receipt, issue, return, adjustment, transfer, and count posts an entry to an append-only ledger.
- The "quantity on hand" you see is always *computed* from that ledger, never stored as a trusted standalone number.
- Every action has an owner, a timestamp, a reason, and — where it matters — a second approver.
- Corrections happen through new, linked entries that net out the old ones. Nothing is ever silently edited or deleted.

---

## Core innovation: the ledger, not the counter

_(This is the one idea the whole system is built around — give it its own slide.)_

| Traditional approach | This system |
|---|---|
| `products.quantity = 42` | `stockBalances` is a computed projection |
| Update overwrites the old value | Every change is a new, permanent ledger row |
| No way to know *why* the number changed | Every row links to the document that caused it |
| Fixing an error means editing the number | Fixing an error means posting a reversal |
| No concurrency protection | Conditional, versioned updates block overselling |

**Analogy:** this is how double-entry bookkeeping works for money. This system applies the same discipline to physical stock.

---

## Full inventory lifecycle, modeled end to end

_(Diagram slide — describe the flow, let Gamma render it as a flowchart.)_

```
Purchase Order → Goods Receipt → Stock Request → Stock Issue → Stock Return
                                        ↓
                          Adjustments · Cycle Counts · Transfers
                                        ↓
                              Reports & Audit Trail
```

Every arrow is a real, permission-gated workflow with its own approval step — not a shortcut. The system models procurement, receiving, fulfillment, corrections, and reporting as one connected chain, not disconnected screens.

---

## Security built in from the start, not bolted on

- Server-side sessions (Redis-backed), never a token sitting in browser storage where script injection could steal it.
- CSRF protection on every state-changing request.
- Granular permissions (60+ distinct permission strings) — no hard-coded roles in the authorization logic, so access control is fully customizable per organization.
- **Separation of duty is enforced in code**: whoever creates a purchase order, stock request, adjustment, transfer, or count can never approve their own — even an administrator account is blocked from this, by design.
- Every sensitive action — postings, approvals, rejections, reversals, logins, permission changes — is written to an append-only audit log with who, when, what, and why.
- Passwords hashed with Argon2id; account lockout after repeated failures; rate limiting on every sensitive endpoint.

---

## Data integrity guarantees

- **Decimal-exact math.** Quantities and money are never stored or computed as JavaScript floating-point numbers — a known source of silent rounding errors in less careful systems. This system uses arbitrary-precision decimals end to end, MongoDB `Decimal128` at rest.
- **Multi-document transactions.** Every posting action — the source document, the ledger rows, the balance update, the audit event — commits atomically on a MongoDB replica set, or none of it commits.
- **Idempotency.** Every stock-posting endpoint requires a unique key per attempt; retrying the exact same request after a network blip can never double-post.
- **Negative stock blocked by default**, with the guard enforced at the database-write level (conditional, versioned updates), not just in application logic — so it holds even under concurrent requests.

---

## What's built (feature tour)

_(One slide per group, or one grid slide with all of them.)_

- **Access control** — users, roles, a 60+ permission catalog with risk levels
- **Organization setup** — company profile, departments, warehouses, storage locations
- **Catalog** — products, categories, units of measure, lot/expiry tracking
- **Suppliers** — vendor directory and contacts
- **Procurement** — purchase orders with a full approval lifecycle
- **Receiving** — goods receipts, verified and posted against purchase orders
- **Requests & fulfillment** — stock requests → FEFO/FIFO-picked issues → returns
- **Corrections** — stock adjustments (with reason codes) and cycle/full counts
- **Transfers** — stock moved between warehouses, with an in-transit state
- **Reporting** — inventory valuation, stock movement, purchases, low/out-of-stock, expiry, full audit trail — all querying live data, never a stale cache
- **Approvals inbox** — every pending approval across every module, in one place

---

## Technology stack

- **MongoDB** (replica-set, transactional) — **Express** — **React** — **Node.js**, all in **TypeScript strict mode**
- **Redis** for sessions, distributed rate limiting, and background job queues
- **BullMQ** workers for async email delivery, idempotent and retried safely
- pnpm workspace monorepo — shared, versioned contracts between frontend and backend so the two can never silently drift apart

---

## Where it stands today

- Core inventory lifecycle (procurement through fulfillment, adjustments, counts, transfers) is fully built and integration-tested against a real MongoDB replica set.
- Full RBAC, audit trail, and reporting suite in place.
- Recently added: purchase-order closure workflow, OTP-based password reset, real transactional email.
- Known next steps: MFA enrollment UI, alerting/notifications for low stock, multi-tenant provisioning for a true SaaS deployment.

---

## The ask / next step

_[Customize this slide to the actual audience — funding, sign-off to deploy, hand-off to a pilot team, etc.]_

- What decision are we asking for today?
- What does the next milestone look like?
- What resources/timeline does it need?
