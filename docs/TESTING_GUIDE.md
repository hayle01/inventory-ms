# Testing Guide

**Status: covers Phases 0–6 plus the Reports slice of Phase 7 (Foundation through Transfers/Adjustments/Counts, plus Inventory/Movement/Purchases/Issues/Low-Stock/Expiry/Audit reporting), built and passing typecheck/lint/build/unit tests as of this writing.** Alerts and queued CSV/PDF report exports (the rest of Phase 7) and Phase 8 (Operations/Hardening) are not implemented yet. This file is updated as each slice lands; re-read the "Status" line before trusting a section.

Integration tests referenced below require a live MongoDB replica set + Redis (`pnpm docker:up`); they have been written but **not executed** in the environment this guide was authored in (no Docker daemon available there). Run them yourself before relying on their pass/fail as ground truth.

---

## 1. Environment setup

```bash
pnpm install
pnpm docker:up                       # starts the Mongo replica set + Redis (infra/docker/compose)
cp .env.example .env                 # if you haven't already; defaults target the compose services
pnpm --filter @inventory-ms/api run db:migrate
pnpm --filter @inventory-ms/api run db:verify-indexes   # optional sanity check, should report no drift
pnpm --filter @inventory-ms/api run seed                # creates the default org + 5 system roles + one admin user
pnpm dev                             # runs API (port from .env, default 4000) + web (default 5173) together
```

The seed script prints the admin username/password **once**, to stdout. If you re-run it, it skips creation silently if the admin already exists (look for `Admin user already exists, skipping creation` in the log instead).

To run everything from a clean slate: `pnpm docker:down`, delete any bind-mounted data volumes if you want a truly empty DB, then repeat the steps above.

### Quality gates

```bash
pnpm typecheck      # all workspaces
pnpm lint           # all workspaces
pnpm build          # all workspaces
pnpm test:unit      # no DB required
pnpm test:integration   # requires docker:up
```

Individual module: `pnpm --filter @inventory-ms/api run test:integration -- stockIssues` (vitest substring match on file name).

---

## 2. How the system is organized

Backend modules under `apps/api/src/modules/`, each with `domain/` (pure business rules), `application/` (services, transactions), `http/` (routes + response mappers), `models/` (Mongoose schemas), `migrations/` (index creation):

| Module | Owns | Phase |
|---|---|---|
| `identity` | users, sessions, login/MFA/password reset | 1 |
| `access` | roles, permissions, permission catalog | 1 |
| `organization` | organizations, departments, warehouses, storage locations | 2 |
| `catalog` | categories, units, products, barcodes | 2 |
| `suppliers` | supplier directory | 3 |
| `procurement` | purchase orders (create → submit → approve/reject → receive → close) | 3 |
| `receiving` | goods receipts (draft → verify → post → reverse), lot creation | 4 |
| `inventory` | the stock ledger (`stockTransactions`), balance projection (`stockBalances`), reservation primitives | 4 |
| `requests` | stock requests (draft → submit → approve/reject/cancel), reservation | 5 |
| `issues` | stock issues (draft → pick → post → reverse), FEFO/FIFO lot allocation | 5 |
| `returns` | stock returns (draft → post), linked to a posted issue | 5 |
| `adjustments` | stock adjustments (draft → submit → approve/reject → post → reverse), signed quantity deltas | 6 |
| `transfers` | stock transfers (draft → submit → approve → post → [in_transit →] receive → reverse), immediate or in-transit | 6 |
| `counts` | stock counts (draft → submit → approve/reject → post → reverse), snapshot + blind count + variance | 6 |
| `reports` | read-only aggregations over source records (inventory, movement, purchases, issues, low-stock, expiry) -- never a copy of report facts | 7 |
| `audit` | append-only audit event log, written by every module; also exposes `GET /audit-events` for the raw log | all (endpoint: 7) |
| `operations` | health/version endpoints | 0 |

Frontend features under `apps/web/src/features/`, one folder per module above (`goods-receipts`, `purchase-orders`, `stock-requests`, `stock-issues`, `stock-returns`, `stock-adjustments`, `stock-transfers`, `stock-counts`, `reports`, etc.), each with `api.ts` (React Query hooks), a list page, a detail page, and (where applicable) a create/edit form page. `reports` breaks that pattern slightly: it's read-only, so instead of list/detail/form it has a hub page plus one page per report type, all sharing a `ReportTable`/`StatCard`/CSV-export component set under `reports/components/` and `reports/lib/`.

### The one invariant that matters most

**`stockTransactions` is the only source of truth for what happened to stock.** `stockBalances` is a projection derived from it — never trust a UI number over the ledger. Every workflow that moves stock (receipt post, issue post/reverse, return post) writes signed rows here inside a MongoDB transaction, in the same commit as the balance update. If you ever see a balance that doesn't match `sum(stockTransactions.quantity)` for its key, that's a bug worth filing immediately — see §7 for the query to check it.

---

## 3. Cross-cutting rules to test against

These apply to *every* module below, not just one — test them once per module, not just once overall, since each module's tests are independent.

- **Decimals are strings on the wire.** Any quantity/money field in a request or response body is a decimal string (`"12.5000"`), never a JSON number. Sending a bare number should fail schema validation (422).
- **Idempotency-Key is mandatory on posting endpoints** (`.../post`, `.../reverse` — anything that writes a ledger row): missing header → `400 IDEMPOTENCY_KEY_REQUIRED`. Same key + same request body replayed → same result, exactly one ledger row. Same key + a *different* request → `409 IDEMPOTENCY_KEY_CONFLICT`.
- **CSRF**: every state-changing request (`POST`/`PATCH`) needs a fresh `X-CSRF-Token` header, sourced from `GET /api/v1/auth/csrf-token` on the same session. A stale or missing token → `403`.
- **Every protected route** checks, in order: authenticated session → active user/org membership → the specific permission string → organization scope on the resource. Test the "no permission" case for every action, not just the happy path — the API and frontend both hide/deny based on the same permission strings (`apps/web/src/features/auth/usePermissions.ts`), but the backend check is authoritative; never trust that hiding a button in the UI is sufficient.
- **Organization scoping**: every list/get/mutate query filters by `organizationId`. A resource from a different org should 404, not 403 (the API doesn't reveal that the record exists elsewhere).
- **Status transitions are whitelisted** per module (`domain/*Status.ts`). Attempting an out-of-order transition (e.g. posting a draft that was never picked) → `422 BUSINESS_RULE_VIOLATION` with a message naming the illegal from/to pair.
- **Posted documents are immutable.** Once a receipt/issue/return is `posted`, there is no PATCH path that touches it — corrections only happen through a linked reversal (receipts, issues) or a fresh compensating document.
- **Audit events** are written for every mutating action, success *and* denial. Check `auditEvents` (via `db.auditEvents.find()` in `mongosh`, or a future `/api/v1/audit` endpoint once Phase 7 lands) after any action you test — the `outcome`, `permissionUsed`, `reason`, and `changedFields` fields should read naturally as "who did what and why."
- **Rate limits**: posting endpoints (`stockPosting` policy) are limited tighter than general reads. If you're scripting many posts in a loop for a stress test, expect `429 RATE_LIMITED` with `Retry-After` once you exceed the configured burst (see `RATE_LIMIT_STOCK_POSTING_MAX`/`_WINDOW_SECONDS` in `.env`).

---

## 4. Auth flow (needed before testing anything else)

```bash
# 1. Get a CSRF token and keep the session cookie (use a cookie jar, e.g. curl -c/-b, or Postman/Insomnia's built-in jar)
curl -c jar.txt -b jar.txt http://localhost:4000/api/v1/auth/csrf-token
# => { "data": { "csrfToken": "..." }, "meta": {...} }

# 2. Log in with that token
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/auth/login \
  -H "X-CSRF-Token: <token from step 1>" -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin","password":"<seeded password>"}'
# => { "data": { "user": {...}, "permissions": ["users.view", ...], "csrfToken": "<NEW token>" } }
```

Login **rotates the session and issues a new CSRF token** — use the one from the login response for the next request, not the pre-login one. Every subsequent state-changing call needs a fresh `GET /csrf-token` + the returned token (the integration tests do this before every single mutation for exactly this reason — see any `fetchCsrf()` helper in `apps/api/tests/integration/*.test.ts`).

Test: logging in with a wrong password should return a **generic** failure message (no "user not found" vs. "wrong password" distinction — check `AuthService.login`). Repeated failures should eventually lock the account (`ACCOUNT_LOCKOUT_THRESHOLD`).

---

## 5. Module-by-module test walkthroughs

Each section: what it does, its status machine, key validations, permissions, and a copy-pasteable curl sequence. All examples assume you're logged in as the seeded admin (which has every permission) and have `jar.txt` from §4; swap in a lower-privilege user to test denial paths.

### 5.1 Identity & Access (Phase 1)

- Users: create/update/activate/deactivate, each gated by its own permission (`users.create`, `users.update`, `users.activate`, `users.deactivate`).
- Roles: named permission bundles (`roles.view`/`roles.manage`); the 5 system roles (`Administrator`, `Store Manager`, `Inventory Clerk`, `Requester`, `Auditor`) are seeded with fixed permission sets — see `apps/api/src/modules/access/domain/permissionCatalog.ts` for exactly which permissions each has. Use this table to build your test matrix: e.g. a `Requester` can create/submit/cancel a stock request but not approve one (structural separation of duty — verified by `stock_requests.approve` returning 403 for that role, not just being absent from the UI).
- Test: create a user with a role that has no `*.view` permission on a module, log in as them, hit that module's list endpoint → `403`.
- Test: session inactivity/absolute expiry, logout, logout-all (revokes every session for that user — log in twice in two cookie jars, `logout-all` from one, confirm the other's next request is `401`).

### 5.2 Organization & Catalog (Phase 2)

- Hierarchy: Organization → Departments / Warehouses → Storage Locations. Products belong to a Category and a Unit, optionally `trackLots`/`trackExpiry` (these two flags drive Receiving's and Issues' validation — see §5.4/§5.6).
- Archive, don't delete: every reference-data resource has a `status` including `archived`; archived records are excluded from `{ $ne: 'archived' }` filters used everywhere else (suppliers, warehouses, products, locations) but remain visible on already-posted historical documents.
- Test: try to reference an archived warehouse/product/location in a new PO/receipt/request — should fail validation (422), since the resolvers filter `status: { $ne: 'archived' }`.
- Test: duplicate `code` within an org → unique index violation surfaces as a safe `409`/`422` (not a raw Mongo error — check the error handler never leaks the index name or raw driver message).

### 5.3 Suppliers & Procurement (Phase 3)

Purchase order status machine: `draft → submitted → approved/rejected/cancelled`; `approved → partially_received/fully_received → closed`. The `received` steps are **only** set by Receiving posting/reversing against the PO (`PurchaseOrderService.applyReceivedQuantities`) — there is no manual way to move a PO into those statuses.

- Test: self-approval — the creator of a PO cannot approve it themselves when `PURCHASE_ORDER_PREVENT_SELF_APPROVAL=true` (default) → `403`. Approve as a different user with `purchase_orders.approve` instead.
- Test: line totals (`lineTotal`, `subtotal`, `taxTotal`, `discountTotal`, grand `total`) are always recomputed server-side from `orderedQuantity`/`unitCost`/`taxAmount`/`discountAmount` — submit a PO with a client-supplied `lineTotal` that doesn't match and confirm the server's number wins (the client field for computed totals isn't even accepted by the create schema — check `packages/contracts/src/procurement/index.ts`).
- Test: editing a PO once it's left `draft` → `422` (`Only draft purchase orders can be edited.`).

### 5.4 Receiving (Phase 4)

Goods receipt status machine: `draft → verified → posted → reversed`. `reversed` is a **stamp** on the original posted receipt (`reversedAt`/`reversedBy`), not a status the document itself transitions through — the actual reversal is a brand-new receipt document with negated quantities and `reversalOfId` pointing back.

```bash
CSRF=$(curl -s -c jar.txt -b jar.txt http://localhost:4000/api/v1/auth/csrf-token | jq -r .data.csrfToken)
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/goods-receipts \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{
    "supplierId":"<id>", "warehouseId":"<id>",
    "items":[{"productId":"<id>","destinationLocationId":"<id>",
      "receivedQuantity":"10","acceptedQuantity":"10","rejectedQuantity":"0",
      "unitCost":"2.50","condition":"good"}]
  }'
# -> draft receipt id

CSRF=$(curl -s -c jar.txt -b jar.txt http://localhost:4000/api/v1/auth/csrf-token | jq -r .data.csrfToken)
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/goods-receipts/<id>/verify -H "X-CSRF-Token: $CSRF"

CSRF=$(curl -s -c jar.txt -b jar.txt http://localhost:4000/api/v1/auth/csrf-token | jq -r .data.csrfToken)
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/goods-receipts/<id>/post \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"

curl -b jar.txt "http://localhost:4000/api/v1/inventory/balances?productId=<id>&warehouseId=<id>"
# -> onHandQuantity should now be 10, availableQuantity 10 (reservedQuantity 0)
```

- Validation: `acceptedQuantity + rejectedQuantity` must equal `receivedQuantity` (schema-level `.refine()`), a product with `trackLots` requires `lotNumber` on any line with `acceptedQuantity > 0`, a product with `trackExpiry` requires `expiresAt`.
- `condition: 'good'` lands stock in `stockState: 'available'`; `'damaged'`/`'quarantine'` land in their own same-named stock state — separate `stockBalances` rows, **not counted as available**. Verify by checking the `stockState` filter on the balances query.
- Idempotency: post the same receipt twice with the same key → exactly one row in `stockTransactions` for that `referenceId`. Same key against a *different* receipt → `409`.
- Reversal: reverse a posted receipt with a reason → new receipt appears with `status: posted`, `reversalOfId` set; original stays `posted` with `reversedAt` set (not editable); net balance change across both is zero.
- Permission denial: strip `receipts.post` from your test user, confirm the receipt stays `verified` (not silently posted) after the denied attempt.

### 5.5 Inventory Ledger (Phase 4, read-only endpoints)

`GET /api/v1/inventory/balances` and `/transactions`, both filterable by `productId`/`warehouseId` (allow-listed query params only — check that passing an arbitrary Mongo operator in the query string, e.g. `?productId[$ne]=null`, is rejected or ignored rather than reaching the query builder unsanitized).

- **The reconciliation check**: for any `(productId, warehouseId, locationId, lotId, stockState)` key, `sum(stockTransactions.quantity where those fields match) === stockBalances.onHandQuantity` for that same key, always. This is the single most important thing to spot-check after any sequence of postings/reversals in manual testing — a mismatch means a transaction committed without its balance update (or vice versa), which should be structurally impossible given everything routes through `postStockMovements`, but is exactly what this check would catch if it weren't.
- `availableQuantity` in the balance DTO is a computed field (`onHandQuantity - reservedQuantity`), not stored — confirm it's never negative even when `reservedQuantity` briefly exceeds `onHandQuantity` in a race (it shouldn't be able to, per the conditional-update guards in `LedgerService`).

### 5.6 Stock Requests (Phase 5, slice 1)

Status machine: `draft → submitted → approved/rejected/cancelled`; `approved → partially_fulfilled/fulfilled` (set only by Issues posting/reversing against this request, same "no manual transition" pattern as PO receiving).

```bash
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-requests \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"warehouseId":"<id>","items":[{"productId":"<id>","requestedQuantity":"5"}]}'

curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-requests/<id>/submit -H "X-CSRF-Token: $CSRF"

# as a DIFFERENT user with stock_requests.approve (self-approval is blocked by default)
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-requests/<id>/approve \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" -d '{}'
```

- Approving reserves stock: check `stockBalances.reservedQuantity` for the product/warehouse increases by the approved amount immediately (no ledger row is written for a reservation — it's a balance-only counter, not a stock movement, so `stockTransactions` is untouched by approval).
- **Design note worth testing deliberately**: reservation is spread across whatever `available` balance rows exist for that product/warehouse at approval time, not pinned to a specific lot/location — it's an aggregate capacity check, not a hard per-row lock. Approving a request when the sum of all rows' `onHand - reserved` is less than requested → `422` (`Insufficient available stock to reserve this quantity.`), and the request stays `submitted`.
- Cancel (from `draft`/`submitted`/`approved`/`partially_fulfilled`) releases any active reservation back — verify `reservedQuantity` drops to 0 on cancel.
- Partial approval: `POST /approve` with `{"items":[{"lineNumber":1,"approvedQuantity":"3"}]}` approves less than requested on that line; a line approved at `0` is a partial rejection while the overall request still becomes `approved`. (The current web UI only offers "approve everything in full" — this per-line path is backend-only for now, testable via curl/Postman.)
- Self-approval: approving your own submitted request (as the same user who created it) → `403`, when `STOCK_REQUEST_PREVENT_SELF_APPROVAL=true` (default).

### 5.7 Stock Issues (Phase 5, slice 2)

Status machine: `draft → picked → posted → reversed`; `cancelled` only reachable from `draft`/`picked` (never after posting).

```bash
# Auto-allocates FEFO/FIFO from the approved request's outstanding lines
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/issues \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"stockRequestId":"<id>"}'
# -> draft issue with auto-picked lines; inspect `items[].lotId`/`lotNumber` to see what was chosen

curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/issues/<id>/pick -H "X-CSRF-Token: $CSRF"
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/issues/<id>/post \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"
```

- **FEFO/FIFO**: for a `trackExpiry` product, receive two lots with different expiry dates (via two separate goods receipts, different `lotNumber`/`expiresAt`), approve a request for a quantity that only the earlier-expiry lot can cover, create the issue, and check the picked line's `lotId` matches the earlier-expiring lot — even if it was received *later* than the other lot. For a non-expiry product, the same test should instead pick whichever lot/location was received first (FIFO), irrespective of any expiry dates. The allocation logic itself has a dedicated unit test suite (`apps/api/tests/unit/lotAllocation.test.ts`, 6 cases) if you want to verify the algorithm in isolation without standing up the whole HTTP flow.
- Creating an issue against a request that isn't `approved`/`partially_fulfilled` → `422`.
- Creating an issue when there's genuinely no available stock for any outstanding line → `422` (`No stock is currently available to pick for this request.`).
- **The concurrency test** (this is the one the roadmap calls out by name — "concurrent issue and insufficient-stock tests"): seed a balance of 8 units, pick two separate issues for 5 units each, `POST /post` both **at the same time** (two parallel requests, distinct idempotency keys). Expect exactly one `200` and one `422`, and the final `onHandQuantity` to be `3` — never negative, never double-decremented. This exact scenario is automated in `apps/api/tests/integration/stockIssues.test.ts` (`MI-10`) — run it, don't just read it.
- Posting releases the request's reservation and advances `fulfilledQuantity`/status (`approved → partially_fulfilled` or `→ fulfilled` depending on whether other lines are still outstanding).
- Reversing a posted issue: creates a linked reversal issue (positive movements, same items), nets the balance back, and walks the source request's `fulfilledQuantity` back down (status returns to `approved`/`partially_fulfilled` as appropriate). It does **not** re-reserve the returned capacity — a fresh issue against the same request would need to re-allocate from whatever's available at that time, first-come-first-served. Test this explicitly if reservation guarantees matter to your scenario.
- Cancel on a `draft`/`picked` issue moves no stock at all — verify the balance is untouched.

### 5.8 Stock Returns (Phase 5, slice 3)

Status machine: `draft → posted` only — no approval step, no reversal (the permission set is deliberately just `returns.view/create/post`).

```bash
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/returns \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"stockIssueId":"<posted issue id>","items":[
    {"stockIssueLineNumber":1,"quantity":"4","condition":"good"}
  ]}'

curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/returns/<id>/post \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"
```

- Can only return against a `posted` issue (not `draft`/`picked`/`reversed`) → `422` otherwise.
- Quantity is capped per-line at `pickedQuantity - returnedQuantity` (cumulative across multiple partial returns of the same issue) — try returning the same line twice, second time exceeding what's left, expect `422` naming the outstanding amount.
- `condition` drives destination stock state exactly like Receiving: `good → available`, `damaged`/`quarantine → their own state`. Test that a `damaged` return does **not** increase `availableQuantity`, only the `damaged`-state balance row.
- After posting, the source issue's line `returnedQuantity` should reflect the returned amount (`GET /api/v1/issues/<id>` and check `items[].returnedQuantity`).

### 5.9 Stock Adjustments (Phase 6, slice 1)

Status machine: `draft → submitted → approved/rejected → posted → reversed` (no cancel branch). Note: `SYSTEM_DOCUMENTATION.md` §9.5 describes this exact machine, but the permission catalog originally shipped without `adjustments.submit/reject/reverse` — those were added specifically to build this slice (see the permission catalog change history); they're real, enforced permissions now, not aspirational ones.

```bash
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-adjustments \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"warehouseId":"<id>","reasonCode":"count_correction",
       "items":[{"productId":"<id>","locationId":"<id>","stockState":"available","quantityDelta":"-3"}]}'

curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-adjustments/<id>/submit -H "X-CSRF-Token: $CSRF"
# as a DIFFERENT user with adjustments.approve
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-adjustments/<id>/approve -H "X-CSRF-Token: $CSRF"
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-adjustments/<id>/post \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"
```

- `quantityDelta` is **signed** — positive increases on-hand, negative decreases it (schema rejects `0`). Posting reuses the exact same `postStockMovements` guard as every other posting flow, so a negative delta that would drive stock below zero → `422`, and nothing partially posts (check no `stockTransactions` row exists for that reference after a failed post — **ADJ-02** from the doc's acceptance matrix, by name).
- **ADJ-01** (the doc's other named case): approve then post a positive adjustment, confirm the ledger row and balance both reflect it, and the audit event carries the reason.
- `requiresElevatedApproval` is a snapshot flag (sum of absolute deltas ≥ `ADJUSTMENT_MATERIAL_QUANTITY_THRESHOLD`, default 100) — informational only in this build. It does **not** gate a stronger permission or trigger MFA step-up (no step-up-auth mechanism exists anywhere in this codebase yet). Don't expect a "material" adjustment to be blocked differently from a small one — only the uniform submit→approve→post gate applies to both.
- Posting also records `priorQuantity`/`resultingQuantity` per line, read from the balance inside the same transaction — check these against the balance before/after.
- Self-approval blocked by default (`ADJUSTMENT_PREVENT_SELF_APPROVAL=true`). Reject records a reason and blocks posting (`422` if you try anyway). Reversal creates a linked adjustment with negated deltas.

### 5.10 Stock Transfers (Phase 6, slice 2)

Status machine: `draft → submitted → approved → completed` (immediate policy) or `draft → submitted → approved → in_transit → completed` (in-transit policy, needs a separate `receive` step) `→ reversed`. No reject/cancel branch (only `transfers.view/create/submit/approve/post/reverse` are permission-gated — `receive` reuses the `transfers.post` permission since there's no dedicated one).

```bash
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-transfers \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"sourceWarehouseId":"<id>","destinationWarehouseId":"<id>","inTransitPolicy":"in_transit",
       "items":[{"productId":"<id>","sourceLocationId":"<id>","destinationLocationId":"<id>","quantity":"4"}]}'

curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-transfers/<id>/submit -H "X-CSRF-Token: $CSRF"
# as a DIFFERENT user with transfers.approve
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-transfers/<id>/approve -H "X-CSRF-Token: $CSRF"
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-transfers/<id>/post \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"
# only for inTransitPolicy: "in_transit" -- status is now "in_transit", not "completed" yet
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-transfers/<id>/receive \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"
```

- **Immediate policy**: `post` moves stock from source `available` straight to destination `available` in one transaction — status goes directly to `completed`, `receivedAt` is stamped at the same moment as `postedAt`.
- **In-transit policy**: `post` decrements source `available` and increments destination `in_transit` (the `in_transit` stock state, already part of `STOCK_STATES` since Phase 4) — status becomes `in_transit`. Check the destination's `available` balance does **not** exist/increase yet at this point, only its `in_transit` row does. `receive` then moves that quantity from destination `in_transit` to destination `available`, status → `completed`.
- Every line requires `sourceLocationId !== destinationLocationId` (schema-level `.refine()`, rejected at `422` before hitting the server) — source and destination warehouses may be the same or different.
- Self-approval blocked by default (`TRANSFER_PREVENT_SELF_APPROVAL=true`).
- Reversal only works from `completed` (regardless of which policy got it there) and always posts as an immediate opposite movement, swapping source/destination.
- **Known scope cut**: the create form doesn't expose lot selection in the UI for lot-tracked products (untracked stock only from the form); the backend accepts an optional `lotId` per line, so a lot-aware transfer is possible via the API.

### 5.11 Stock Counts (Phase 6, slice 3)

Status machine: `draft → submitted → approved/rejected → posted → reversed` (shared shape with Adjustments). Creating a count immediately snapshots `systemQuantity` per line from the current balance — there's no separate "start" step (the doc's endpoint map lists one, but no permission gates it distinctly, so snapshot-on-create was the simpler, equally-correct choice).

```bash
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-counts \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"warehouseId":"<id>","scope":"cycle","blindCount":true,
       "items":[{"productId":"<id>","locationId":"<id>"}]}'
# -> draft count; items[0].systemQuantity is the snapshot, countedQuantity is null

curl -c jar.txt -b jar.txt -X PATCH http://localhost:4000/api/v1/stock-counts/<id> \
  -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
  -d '{"items":[{"lineNumber":1,"countedQuantity":"7"}]}'

curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-counts/<id>/submit -H "X-CSRF-Token: $CSRF"
# variance is computed here: countedQuantity - systemQuantity, e.g. 7 - 10 = -3

# as a DIFFERENT user with stock_counts.approve
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-counts/<id>/approve -H "X-CSRF-Token: $CSRF"
curl -c jar.txt -b jar.txt -X POST http://localhost:4000/api/v1/stock-counts/<id>/post \
  -H "X-CSRF-Token: $CSRF" -H "Idempotency-Key: $(uuidgen)"
```

- Submitting with any line's `countedQuantity` still `null` (not yet entered) → `422` naming the uncounted line. Enter all lines via one or more `PATCH` calls first (the web UI's "Save counts" button does this).
- **Blind count** (`blindCount: true`, the default): the web UI hides `systemQuantity` from the counter while the count is `draft`, revealing it only after submission — this is a UI-layer convenience, not a server-enforced secrecy guarantee (`GET` always returns `systemQuantity` in the API response; don't rely on the field being absent from the wire, only hidden in the rendered table).
- Posting reuses the **same ledger mechanism as Adjustments** — each non-zero `varianceQuantity` becomes a signed `stockTransactions` row with `transactionType: 'adjustment'` and `reasonCode: 'count_correction'`, `referenceType: 'stockCount'`. This is deliberate: a count variance *is* an adjustment, just derived from a physical count instead of a manually-entered delta. Check `GET /api/v1/inventory/transactions?...&referenceType=stockCount` isn't a real filter (only `productId`/`warehouseId` are allow-listed) — filter client-side on `referenceId` instead if you need to isolate a specific count's movements.
- Self-approval blocked by default. Reject records a reason and blocks posting. Reversal creates a linked count with negated variances.

### 5.12 Reports and audit trail (Phase 7, slice 1)

Seven read-only endpoints, all gated by `reports.view` except the audit trail (`audit.view`): `GET /reports/inventory`, `/stock-movement`, `/purchases`, `/issues`, `/low-stock`, `/expiry`, and `GET /audit-events`. **Every report queries source records live** (`stockBalances`, `stockTransactions`, `purchaseOrders`, etc.) — there is no `reports` collection storing stale copies, per the doc's explicit requirement. This is the one module in the system with no status machine and no posting — it's pure read.

```bash
curl -b jar.txt "http://localhost:4000/api/v1/reports/inventory?warehouseId=<id>"
curl -b jar.txt "http://localhost:4000/api/v1/reports/stock-movement?productId=<id>&page=1&perPage=50"
curl -b jar.txt "http://localhost:4000/api/v1/reports/purchases?supplierId=<id>"
curl -b jar.txt "http://localhost:4000/api/v1/reports/issues?warehouseId=<id>"
curl -b jar.txt "http://localhost:4000/api/v1/reports/low-stock?warehouseId=<id>"
curl -b jar.txt "http://localhost:4000/api/v1/reports/expiry?warehouseId=<id>&withinDays=30"
curl -b jar.txt "http://localhost:4000/api/v1/audit-events?resourceType=stockIssue&page=1&perPage=25"
```

- **Reconciliation test** (this is the doc's own acceptance criterion, `REPORT-01`/`REPORT-02`): the inventory report's `onHandQuantity` per product/warehouse must equal the sum of `stockBalances.onHandQuantity` for that key (it's the same aggregation, just re-grouped and joined with product cost for `valuation`); the stock-movement report's rows and `summary.totalIn`/`totalOut` must equal what you'd get querying `stockTransactions` directly. If these ever diverge, that's a real bug — the report code does its own independent aggregation rather than reusing `/inventory/balances`, specifically so a divergence would be caught by comparing the two instead of both silently sharing one bug.
- **Low-stock report**: only flags a line when `availableQuantity <= 0` (severity `out`, regardless of `reorderLevel`) or when `reorderLevel > 0 AND availableQuantity <= reorderLevel` (severity `low`). A product with `reorderLevel: 0` (the default) never shows as "low," only "out" — test this distinction explicitly, it's easy to assume every product with any stock shortfall gets flagged.
- **Expiry report**: severity is `expired` (≤0 days), `critical` (≤7 days), or `warning` (up to `withinDays`, default 90). Only lots with a positive issuable (`available`-state) balance are included — a fully-issued or fully-quarantined lot past its expiry won't appear, matching §11.7's "active lots with positive issuable balance."
- **Purchases report**: `bySupplier` is a derived rollup of the same `rows`, not a separate query — check the totals reconcile (`sum(bySupplier[].totalValue) === totals.totalValue`).
- **Audit trail**: paginated via `sendPaginated` (unlike every other report, which returns an unpaginated aggregate) — check `meta.total`/`meta.hasNext` behave correctly across pages, and that a **denied** action (e.g. a 403 from a permission check elsewhere in the system) shows up here with `outcome: "denied"`, not just successes.
- Permission denial: a user with neither `reports.view` nor `audit.view` gets `403` on every one of these endpoints — test at least one report and `/audit-events` explicitly, they're gated by different permissions.
- **CSV export is client-side only in this build** — the "Export CSV" button on each report page builds a CSV from whatever rows are currently loaded in the browser and downloads it directly (see `apps/web/src/features/reports/lib/csv.ts`). This is *not* the doc's queued `POST /report-exports` → `GET /report-exports/:id/download` flow (async, access-controlled, time-limited signed download) — that infrastructure (object storage client, BullMQ export worker, `reportExports` collection) doesn't exist yet. It's flagged below in §8, not silently passed off as the same thing.

---

## 6. End-to-end scenario (run this once, start to finish, after any significant change)

This chains every Phase 3–5 module and gives you a single balance number to sanity-check at each step (Phase 6's modules — Adjustments, Transfers, Counts — are independent workflows that don't chain naturally onto this one request/issue/return sequence; test them via their own sections above instead). All quantities for one product in one warehouse:

1. Create + submit + approve a PO for **20** units. `receivedQuantity` starts at 0.
2. Create a goods receipt against that PO for **20** units, `condition: good`. Verify → Post.
   - Expect: PO status → `fully_received`. Balance: `onHand=20, reserved=0, available=20`.
3. Create + submit a stock request for **8** units. Approve it (as a different user).
   - Expect: Balance: `onHand=20, reserved=8, available=12`.
4. Create a stock issue from that request (auto-allocates). Pick. Post.
   - Expect: Balance: `onHand=12, reserved=0, available=12`. Request status → `fulfilled`.
5. Create a return against that issue for **3** units, `condition: good`. Post.
   - Expect: Balance: `onHand=15, reserved=0, available=15`. Issue line `returnedQuantity=3`.
6. Reverse the *original goods receipt* (reason required) — this is a legitimate independent action since the receipt is still `posted` and not otherwise touched by the later steps.
   - Expect: a new reversal receipt appears, `onHandQuantity` drops by 20 from wherever it was (→ `-5` is **impossible** — if you get a negative number here, something is very wrong, since 15 available < 20 to reverse... actually check: the negative-stock guard applies to *available-stock-decrementing* movements, and a reversal of a receipt is exactly that (negative quantity movement) — so if you've since issued/returned stock such that `onHand < 20`, **this reversal should fail with `422 Insufficient available stock`**, not succeed and go negative. This is a good deliberate test of the guard working across module boundaries, not just within one.

At every step, cross-check `GET /api/v1/inventory/transactions?productId=<id>&warehouseId=<id>` — the running sum of `quantity` should equal the current `onHandQuantity` from `/balances` for the matching `(locationId, lotId, stockState)` key.

---

## 7. Manual DB checks (mongosh)

```js
use ims

// Ledger sum vs. balance projection, for one balance key
db.stockTransactions.aggregate([
  { $match: { productId: ObjectId('<id>'), warehouseId: ObjectId('<id>') } },
  { $group: { _id: { locationId: '$locationId', lotId: '$lotId', stockState: '$stockState' },
              total: { $sum: { $toDecimal: '$quantity' } } } },
])
db.stockBalances.find({ productId: ObjectId('<id>'), warehouseId: ObjectId('<id>') })
// The `total` per key above should equal `onHandQuantity` for the matching row.

// Recent audit trail for a resource
db.auditEvents.find({ resourceType: 'stockIssue', resourceId: ObjectId('<id>') }).sort({ createdAt: -1 })

// Confirm no posted document was ever edited outside the posting service
// (there's no direct way to check this via a query; it's structural -- Mongoose schemas
// don't block writes, so this is really "did you, the tester, ever see a PATCH succeed
// against something already posted?" -- it shouldn't, per every service's status guard)
```

---

## 8. Known gaps / things not to bother testing yet

- **No pagination on `requests`/`issues`/`returns`/`goods-receipts`/`purchase-orders`/`stock-adjustments`/`stock-transfers`/`stock-counts` list endpoints** — they return the full org-scoped list via `sendSuccess`, not `sendPaginated`. Fine for test-scale data; will need addressing before this is production-scale (flagged, not fixed, in this pass).
- **No line-by-line pick editor in the Stock Issues UI** — the backend's `PATCH /issues/:id` accepts per-line lot/location/quantity overrides while `draft`, but the frontend only shows the auto-allocated result read-only. Test the override path via curl/Postman if you need it.
- **No per-line partial-approve UI on Stock Requests** — same story, backend supports it (`POST /stock-requests/:id/approve` with an `items` array), frontend always approves everything in full.
- **No lot selection in the Stock Transfers create form** — untracked stock only from the UI; the backend accepts an optional `lotId` per line via the API.
- **Status-model naming deviation**: `SYSTEM_DOCUMENTATION.md` §9.3 describes stock request statuses as `partially_approved`/`partially_issued`/`fully_issued`/`closed`; the actual implementation uses `partially_fulfilled`/`fulfilled` and has no `closed` state. This was a deliberate call made during Phase 5 slice 1 and flagged rather than silently patched.
- **Permission catalog extended beyond the original shipped set**: `adjustments.submit/reject/reverse`, `stock_counts.submit/reject/reverse`, and `transfers.submit` did not exist before Phase 6 — they were added deliberately (with explicit sign-off) to match the status machines `SYSTEM_DOCUMENTATION.md` §9.5 and the endpoint map describe, since the originally-shipped permission catalog couldn't gate those steps at all. If you're testing against an older seeded database, re-run `pnpm --filter @inventory-ms/api run seed` or otherwise re-sync `SYSTEM_ROLE_PERMISSIONS` — existing custom roles won't retroactively gain the new permissions.
- **No "start" step for Stock Counts** — the doc's endpoint map lists a separate `POST /stock-counts/:id/start`; this build snapshots `systemQuantity` at creation instead (see §5.11), since no permission distinctly gates a "start" verb.
- **Counts' blind-count flag is UI-only**, not a server-side field redaction — see §5.11.
- **No pagination on `/reports/inventory`/`/purchases`/`/issues`/`/low-stock`/`/expiry`** — same story as the workflow list endpoints. `/reports/stock-movement` and `/audit-events` are the two exceptions (page/perPage, the latter with full `meta.total`).
- **Report CSV export is client-side only** — no queued `report-exports` background job, no object storage upload, no signed time-limited download link. See §5.12. The doc's async export design (`POST /report-exports` → worker generates the file → `GET /report-exports/:id/download`) is still on the roadmap.
- **No Alerts module yet** — no low-stock/expiry *alert* documents (persistent, deduplicated, acknowledge/resolve), no `/api/v1/alerts` endpoints, no scheduled evaluation job. The Low-Stock and Expiry *reports* (§5.12) are live queries that cover the same underlying data on demand, but they are not the same thing as a standing, deduplicated alert record — don't conflate the two when testing.
- **Phase 8 doesn't exist**: no Operations/Hardening (backup run tracking, restore drill, load tests) beyond what Phase 0 already provides (`/operations/health`, `/operations/version`).

---

## 9. Automated test inventory (what's already codified, so you're not duplicating effort)

| File | Covers |
|---|---|
| `apps/api/tests/unit/errors.test.ts` | Error class → HTTP status/code mapping |
| `apps/api/tests/unit/lotAllocation.test.ts` | FEFO/FIFO pure allocation function, 6 cases |
| `apps/api/tests/integration/receiving.test.ts` | Receipt create/verify/post, idempotency (replay + conflict), reversal netting, permission denial |
| `apps/api/tests/integration/stockRequests.test.ts` | Create/submit/approve/reject/cancel, reservation increment, insufficient-stock rejection, self-approval denial, permission denial, validation |
| `apps/api/tests/integration/stockIssues.test.ts` | Full request→issue→pick→post flow, idempotency, reversal, cancel, **and the concurrent-oversell test (MI-10)** |
| `apps/api/tests/integration/stockReturns.test.ts` | Create/post against a posted issue, over-return rejection, condition→stock-state routing, idempotency, permission denial |
| `apps/api/tests/integration/stockAdjustments.test.ts` | **ADJ-01/ADJ-02** from the doc's acceptance matrix, negative-adjustment insufficient-stock rejection, self-approval denial, reject-blocks-posting, reversal netting, material-threshold flag, permission denial |
| `apps/api/tests/integration/stockTransfers.test.ts` | **TRF-01** (immediate, one-step move), **TRF-02** (in-transit hold then receive), idempotency, self-approval denial, reversal netting, same-location validation rejection, permission denial |
| `apps/api/tests/integration/stockCounts.test.ts` | **CNT-01** (short count posts a negative variance), uncounted-line submit rejection, reject-blocks-posting, self-approval denial, reversal netting, permission denial |
| `apps/api/tests/integration/reports.test.ts` | **REPORT-01/REPORT-02** (inventory and movement reports reconcile against the ledger/balance projection), purchases report outstanding + supplier rollup, low-stock severity distinction, expiry severity bucketing, issues report summary, audit-events pagination envelope, permission denial on both `reports.view` and `audit.view` |

Run the whole integration suite in one go: `pnpm --filter @inventory-ms/api run test:integration` (needs `pnpm docker:up` first).
