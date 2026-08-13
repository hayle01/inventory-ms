# Defense Preparation — Deep Understanding Guide

This is for you, not an audience. Goal: understand the system deeply enough that any question a defense/review panel throws at you, you can answer from genuine understanding — not from memorized bullet points. Organized around the 80/20 rule: **Part 1 is the 20% of ideas that explain 80% of this system.** Master that first. Everything after is depth, anticipated questions, and honesty about what isn't finished.

---

## Part 1 — The five ideas that explain almost everything

If you only remember five things walking into the room, remember these. Every other design decision in the system is a consequence of one of these.

### 1. The ledger is truth. The balance is a cached opinion.

This is the single most important idea in the whole system, and it's worth being able to explain it without notes.

Most simple systems store `product.quantity = 42` and just overwrite that number every time stock moves. That number has no memory — you can't ask it "why," you can only ask it "what, right now." If it's wrong, the only fix is to guess a new number and overwrite again.

This system instead writes an **immutable row to a `stockTransactions` ledger** for every single movement — a receipt, an issue, a return, an adjustment, a transfer. Each row is signed (positive = stock in, negative = stock out), timestamped, attributed to an actor, and linked to the document that caused it (a receipt number, an issue number, etc.). Rows are **never edited or deleted, ever.**

`stockBalances` — the "on hand" number you actually see in the UI — is a **projection**: it's what you get if you summed every ledger row for that product/location/lot. The system keeps it as a live-updated cache for read performance (so you don't sum thousands of rows on every page load), but the ledger is the *source of truth*. If the two ever disagreed, the ledger wins, and a reconciliation job exists specifically to catch and report that disagreement.

**Why this matters for a defense:** this is directly modeled on double-entry bookkeeping. Nobody would accept an accounting system where you could just edit a past transaction to make the books balance — you'd post a correcting entry instead, and both entries stay visible forever. This system applies that same discipline to physical inventory, which is just as auditable and just as prone to disputes as money.

### 2. Corrections are new documents, never edits.

A direct consequence of #1: once something posts (a receipt, an issue, an adjustment, a transfer, a count), it becomes **read-only forever**. There is no "edit" button on a posted document, anywhere in the system, for anyone, including an administrator.

If something needs correcting, you create a **reversal** — a new, linked document that nets the original back out. Both the original and the reversal stay visible side by side. This gives you a complete, tamper-evident history: you can always answer "what did the system say at any point in time," not just "what does it say now."

### 3. Money and quantities are never JavaScript floating-point numbers.

`0.1 + 0.2 !== 0.3` in every language with IEEE-754 floats, including JavaScript. For a system tracking money and stock quantities — where being off by a fraction of a cent or a fraction of a unit, repeated across thousands of transactions, adds up to a real discrepancy — this is unacceptable.

Every quantity and money value crosses the API as a **string** (`"12.50"`, not `12.5`), is manipulated with an arbitrary-precision decimal library in application code, and is stored as MongoDB's `Decimal128` type at rest. `Number`, `parseFloat`, and implicit numeric coercion on these fields are treated as bugs, not style preferences.

### 4. Every workflow is a state machine, and posting requires two people.

Every business document (purchase order, receipt, stock request, issue, return, adjustment, transfer, count) moves through a fixed sequence of statuses — `draft → submitted → approved → posted`, roughly, with variations per module. You cannot skip a step. The system enforces this centrally (a small `assertXTransition(from, to)` function per module) so "can this document move to this status" is answered in exactly one place, not scattered across every button in the UI.

Layered on top of that: **separation of duty**. Whoever *creates* a document that requires approval can never *approve* it themselves — not even an administrator account. This is enforced server-side, in the same service function that performs the approval, so it can't be bypassed by hiding or showing a button in the UI. You need at least two people (or two accounts) to move anything sensitive from submitted to approved.

### 5. Concurrency safety comes from the database, not from hoping requests don't collide.

If two people try to issue the last 5 units of a product at the exact same moment, a naive "read the balance, check if enough, write the new balance" sequence can let both succeed — a classic race condition, and the single most common way inventory systems silently oversell.

This system prevents it with **conditional, versioned writes**: the decrement to a balance is a single atomic database operation that says "subtract N *only if* the current available quantity is still ≥ N and the version number hasn't changed since I read it." If another request beat you to it, your write fails outright — not partially, not with a corrupted number — and the application layer reports it as a clean "insufficient stock" conflict. Combined with MongoDB multi-document transactions (so the ledger row, the balance update, and the source document status all commit together or not at all), this makes overselling structurally impossible, not just unlikely.

---

## Part 2 — Why these technology choices (anticipate "why not X" questions)

**Why MongoDB instead of a relational database, for something that sounds like accounting?**
Two reasons. First, the document model fits the domain well — a purchase order with a variable number of line items, or a stock count with hundreds of counted lines, maps naturally onto an embedded array without the join overhead a relational schema would need. Second, MongoDB's multi-document ACID transactions (since v4.0, on a replica set) give the same atomicity guarantee a relational database would for the ledger-write-plus-balance-update-plus-audit-event sequence — the system doesn't sacrifice consistency to get the document model's flexibility. The system deliberately requires a replica set (not a standalone instance) everywhere, including local dev and CI, specifically *because* transactions require it — this was a conscious constraint, not an oversight.

**Why not just add columns and triggers to enforce this in a relational database instead?**
You could build an equivalent ledger-based system relationally — this isn't a MongoDB-specific idea. The choice here was about developer velocity and schema flexibility for a system with many variably-shaped documents (line items, audit metadata, per-module extra fields), not a claim that MongoDB is uniquely capable of this pattern.

**Why server-side sessions instead of JWTs in localStorage?**
A JWT sitting in `localStorage` or `sessionStorage` is readable by any JavaScript running on the page — including injected script from an XSS vulnerability. A session ID in an `HttpOnly` cookie is not readable by JavaScript at all, which removes an entire class of token-theft attack. The tradeoff is that server-side sessions need a shared session store (Redis here) and don't scale as trivially "statelessly" as JWTs across many API servers — an acceptable tradeoff for the security gain, and Redis already existed in the stack for rate limiting and queues.

**Why CSRF protection if you're using cookies, and why does that even matter?**
Because cookies are sent automatically by the browser on every request to the matching domain, a malicious site can trick a logged-in user's browser into firing a state-changing request (e.g., "delete this purchase order") without the user's knowledge — that's what CSRF protection stops. This is the direct tradeoff of choosing cookie-based sessions over bearer tokens: you gain XSS-theft resistance, but you take on CSRF risk, which then has to be explicitly defended (double-submit cookie tokens plus Origin/Referer checks here).

**Why a monorepo with a shared `contracts` package instead of separate repos for frontend/backend?**
The frontend and backend share the exact same Zod schemas for every request/response shape — defined once in `packages/contracts`, imported by both. This means a backend change to a field's validation rule (say, tightening a minimum password length) is a type error on the frontend the moment it happens, at compile time, not a bug discovered in QA. It also means the two can never silently drift into incompatible shapes.

**Why TypeScript strict mode everywhere, including the workers?**
Quantities and money are represented as strings specifically so a type system can catch accidental numeric coercion. Strict mode is what makes that catchable — without it, `null`/`undefined` handling and implicit `any` would quietly undermine the same guarantees the decimal-string design is trying to enforce.

---

## Part 3 — Walk through one real transaction end to end

Being able to narrate this from memory, in your own words, is worth more than any slide. Use the "receive stock against a purchase order" flow — it touches almost every core idea at once.

1. A **Purchase Order** is created (draft), listing products, quantities, and unit costs. It's submitted, then approved by someone *other than* whoever created it (separation of duty).
2. Someone clicks **Receive** on the approved PO. This opens a **Goods Receipt**, pre-filled with the outstanding ordered quantities. The clerk records what was actually received, how much was accepted vs. rejected, the condition, and — if the product tracks lots/expiry — the lot number and expiry date.
3. The receipt is **verified** (a review checkpoint — no stock has moved yet), then **posted**.
4. Posting is where the interesting part happens, all inside **one MongoDB transaction**:
   - A `receipt` row is written to the immutable ledger for each accepted line.
   - The `stockBalances` projection for each product/location/lot is incremented — via the conditional, versioned write from Part 1, idea 5.
   - The originating Purchase Order's `receivedQuantity` per line is updated, and its status automatically flips to `partially_received` or `fully_received` depending on whether everything ordered has now arrived — this is a cross-module effect (Receiving updates data that conceptually "belongs" to Procurement) done through an exported application function, never by directly touching another module's MongoDB model — a deliberate architectural boundary, discussed in Part 4.
   - An audit event is recorded: who posted it, when, with what correlation ID.
   - The whole set of writes commits together, or — if anything fails partway (a conflict, a validation failure, a database hiccup) — **none of it commits**. There is no state where the ledger updated but the balance didn't, or the PO updated but the audit event didn't.
5. The request also carried an **Idempotency-Key** header. If the network hiccups and the browser retries the exact same post, the server recognizes the key and returns the same result without posting a second time — this is what makes retries safe.
6. Once fully received, the PO can be manually **closed** — a deliberate final step confirming nothing more will arrive against it.

If you can narrate that sequence and explain *why* each step matters (not just *what* it does), you can defend the system.

---

## Part 4 — Architecture boundaries (the "why is it organized this way" questions)

**Module boundary rule**: a module's code may never import another module's MongoDB model directly. If Receiving needs to affect Procurement's data (step 4 above), it calls an *exported function* from Procurement's application layer, not `PurchaseOrderModel.updateOne(...)` directly. This exists so that every module's invariants (its own validation rules, its own state machine) are enforced in exactly one place, and can't be silently bypassed by another module reaching around them. It's the same idea as "don't reach into another team's database" in a microservices architecture, applied inside a single deployable monolith — you get the encapsulation benefit without the operational cost of running twenty separate services.

**Why a modular monolith instead of microservices?** At this system's current scale, the operational overhead of microservices (service discovery, distributed tracing, network-call failure handling, data consistency across service boundaries) would cost more than it returns. The module-boundary discipline above means the codebase is already organized *as if* it could be split into services later, without paying that cost now.

**Controllers are thin; workflows live in application services; domain rules live in domain services.** A controller (HTTP route handler) does exactly three things: validate the request shape, call an application-layer function, map the result to a response. It contains no business logic. The application layer orchestrates a workflow (e.g., "approving a stock request means: check the transition is legal, check separation of duty, reserve the stock, write the audit event"). Pure domain logic (e.g., "is this a legal status transition," or "given these available lots, which ones do FEFO allocation pick") lives in dependency-free functions that don't touch the database at all — which is exactly why the lot-allocation logic could be unit-tested in isolation without spinning up MongoDB.

---

## Part 5 — Hard questions a review panel is likely to ask, with honest answers

**"What happens if the server crashes in the middle of posting a transaction?"**
MongoDB's transaction guarantee means a crash mid-transaction results in nothing committing — the transaction is atomic. On restart, the client (or a retry) simply attempts the same operation again, and the Idempotency-Key guarantees that even if the original request's response was lost, retrying doesn't double-post.

**"How do you know your negative-stock and concurrency protections actually work, versus just assuming they do?"**
There's a dedicated concurrency integration test that fires two simultaneous issue-posting requests against a balance with only enough stock for one to succeed, run against a real MongoDB replica set (not a mock) — and asserts exactly one succeeds and the other gets a clean conflict, never a negative balance and never two successful posts. This is called out explicitly as a mandatory test category, not an incidental one.

**"Isn't requiring two people to approve everything going to slow the business down?"**
It's configurable per workflow (an environment flag can disable the self-approval rule per module if an organization decides the tradeoff isn't right for them), but the default is on, deliberately, because the cost of a single person being able to create *and* approve a fraudulent or mistaken high-value adjustment silently is higher than the cost of routing it to a second reviewer.

**"What's actually NOT finished? What would you tell an investor/reviewer honestly?"**
Be ready to say, plainly: MFA enrollment has no UI yet (the backend supports TOTP challenges at login, but there's no way to turn it on for an account through the browser). There's no automated low-stock alerting/notification system yet, only the on-demand Low Stock report. The system is architecturally ready for multi-tenancy (every record is organization-scoped) but there's no self-service tenant provisioning — today it's one organization per deployment, set up via a seed script. There are a small number of known-flaky pre-existing integration tests in the stock-issue/stock-return suites unrelated to core correctness (test setup ordering, not a data-integrity bug) — worth mentioning if asked about test coverage, rather than claiming 100% green.

**"Why should I trust that quantities are exact, not just 'probably fine'?"**
Because there's a dedicated test category for decimal precision preservation — entering a fractional quantity and confirming it round-trips through the full receive → post → report pipeline without drift — and because the type system itself makes it a compile error to use `Number()` or `parseFloat()` on a quantity/money field in reviewed code paths.

**"How is authorization actually enforced — could someone bypass it by hitting the API directly instead of clicking through the UI?"**
Yes, and that's the point of the test suite: UI buttons are hidden based on permissions purely as a UX convenience (so people don't see options they can't use), but every single permission, scope, and separation-of-duty check is re-verified server-side on every request, independent of what the UI shows. The mandatory testing rules require a permission-denied test for every workflow precisely so the UI can never become the actual security boundary.

**"What would you do differently if you rebuilt this from scratch?"**
Have a real, prepared answer here — panels respect honest reflection. Reasonable, defensible answers: build the alerting/notification system alongside the reporting suite instead of after it (they share a lot of the same "is this product low" logic); or design the multi-tenant provisioning flow earlier, since retrofitting a signup/tenant-creation flow onto an already-built single-tenant seed script is more work than doing it from the start.

---

## Part 6 — Glossary (say these correctly, without hesitation)

- **Ledger** — the append-only `stockTransactions` collection; the only source of truth for what happened to stock.
- **Balance / projection** — `stockBalances`; a cached, always-current sum derived from the ledger, kept for fast reads.
- **Reversal** — a new document that nets out a previously posted one; the only way to "undo" something.
- **Idempotency key** — a client-supplied unique value per attempt that guarantees a retried request doesn't double-post.
- **Separation of duty** — the rule that a document's creator can never also approve it.
- **FEFO / FIFO** — First-Expired-First-Out / First-In-First-Out; the two lot-allocation strategies used when picking stock for an issue (FEFO for lot/expiry-tracked products, FIFO otherwise).
- **RBAC** — Role-Based Access Control; here, specifically *permission-based*, since authorization checks a granular permission string, never a role name, directly in code.
- **Optimistic concurrency / versioning** — the `version` field incremented on every write, used to detect and reject a write based on stale data.
- **Decimal128** — MongoDB's arbitrary-precision decimal storage type, used for every quantity and money field instead of a floating-point number.

---

## Part 7 — If they ask you to demo or show code live

Know where to go without hunting:

- Core ledger-write logic: `apps/api/src/modules/inventory/application/LedgerService.ts`
- A representative status machine: `apps/api/src/modules/procurement/domain/purchaseOrderStatus.ts`
- Separation-of-duty check (self-approval block): search `preventSelfApproval` in any module's application service
- FEFO/FIFO allocation (pure, unit-tested): `apps/api/src/modules/issues/domain/lotAllocation.ts`
- Permission catalog and seeded role bundles: `apps/api/src/modules/access/domain/permissionCatalog.ts`
- Audit event recording: `apps/api/src/modules/audit/application/AuditService.ts`
- The project's own engineering contract (read this before claiming anything about the rules — it's the actual source of truth for "why"): `CLAUDE.md` and `SYSTEM_DOCUMENTATION.md` at the repo root.

If someone asks "show me a negative-stock rejection happen live," the fastest path is: pick a low-stock product on the Low Stock report, open two browser tabs, try posting an issue for more than available in each nearly simultaneously — or simpler, just try to issue more than available in one tab and show the clean `422` rejection.
