# CLAUDE.md - Secure MERN Inventory Management System

## Mission

Build the Inventory Management System defined in `SYSTEM_DOCUMENTATION.md`. Treat that file as the product and engineering contract. If the repository later splits it into `README.md`, `docs/`, or ADRs, those files become additional contracts and must remain consistent with the system document.

This project MUST use the MERN stack:

- MongoDB with replica-set transaction support
- A supported Node.js LTS release and supported Express release, pinned in the repository
- A stable React release, pinned in the repository
- TypeScript in strict mode across frontend, backend, workers, and shared packages
- Redis for sessions, distributed rate limiting, queues, cache, and scheduler locks

Do not introduce PHP, Laravel, MySQL, SQL migrations, or SQL-specific locking patterns.

## Read before coding

Read these materials before changing code:

1. `SYSTEM_DOCUMENTATION.md` in full, especially the inventory invariants, data model, API rules, security architecture, testing strategy, roadmap, release gates, and open decisions.
2. `README.md`, `docs/`, and ADRs when they exist in the repository.
3. The relevant module code, schemas, indexes, migrations, tests, and operational configuration.

If documents conflict, stop and report the conflict instead of choosing silently. Then inspect the repository and summarize what exists, what is incomplete, and what assumptions remain.

## Working method

1. Propose the smallest complete vertical slice from the roadmap.
2. Implement one milestone at a time. Never generate the entire system in one unreviewable change.
3. Show domain rules, schemas, migrations/indexes, and transaction design before controllers and UI.
4. Add validation, authorization, audit, errors, idempotency, and tests in the same change as the feature.
5. Run formatting, linting, type checking, unit tests, integration tests, security tests, build, and migration checks.
6. Update documentation, ADRs, and the implementation checklist.
7. Never weaken authorization, validation, auditability, decimal precision, or inventory integrity to make a test pass.

## Required repository architecture

Use a pnpm workspace modular monorepo:

```text
apps/
  web/       React SPA
  api/       Express modular monolith
  worker/    queues and scheduled jobs
packages/
  contracts/ shared DTO and schema contracts
  config/    validated configuration
  ui/        reusable accessible components
  eslint-config/
  tsconfig/
infra/
docs/
tests/e2e/
```

Backend modules:

- Identity
- Access
- Organization
- Catalog
- Suppliers
- Procurement
- Receiving
- Inventory Ledger
- Requests
- Issues
- Returns
- Transfers
- Adjustments
- Counts
- Alerts
- Reporting
- Audit
- Operations

Keep controllers thin. Workflows belong in application services. Inventory invariants belong in domain services. Infrastructure must not leak into domain rules. A module must not import another module's MongoDB model directly; use exported application contracts.

## Mandatory inventory invariants

- Every stock change creates one or more immutable `stockTransactions` documents.
- The source document, ledger rows, stock balance projection, reservations, idempotency result, and audit event commit in one MongoDB transaction where applicable.
- `stockTransactions` is authoritative. `stockBalances` is a transactional read projection.
- Never create or use `products.quantityInStock` as the source of truth.
- Block negative available stock by default.
- Posted documents and ledger transactions cannot be edited or deleted.
- Corrections use linked reversal, return, adjustment, or compensating documents.
- Expiry-tracked receipts require lot number and expiry date.
- Use FEFO for expiry-tracked issues and FIFO otherwise.
- Record and audit any authorized allocation override.
- Quantities and money use MongoDB Decimal128 and a decimal arithmetic library.
- API decimal values are strings. Never use `Number`, `parseFloat`, implicit numeric coercion, or JavaScript floating-point arithmetic for quantities or money.
- Posting endpoints and retried jobs require idempotency protection.
- Reconcile balance projections to ledger totals on a schedule.

## MongoDB transaction and concurrency rules

- Local, test, staging, and production MongoDB must support multi-document transactions. Use a replica set or compatible managed cluster; do not rely on standalone MongoDB.
- Use a shared transaction wrapper based on `session.withTransaction` or the selected driver equivalent.
- Pass the session to every operation in the transaction.
- Do not run parallel operations with `Promise.all` inside a transaction.
- Keep transactions short; never call email, SMS, object storage, PDF generation, or other external services inside a transaction.
- Use majority write concern and the approved transaction options for critical posting.
- Use deterministic ordering for balance updates.
- Decrement stock with conditional predicates that prove available quantity and expected version.
- Retry only recognized transient transaction or unknown-commit-result conditions, with bounded attempts and correlation logging.
- A failed predicate, stale version, or exhausted stock is a conflict/business error, not a partial success.

## Data model rules

- All organization-owned records include `organizationId` and every repository query applies organization scope.
- Use ObjectId consistently for internal identifiers and human-readable codes/document numbers for business records.
- Store timestamps in UTC and display the configured organization timezone.
- Archive referenced master data instead of hard deleting it.
- Use collection validators and unique indexes for critical rules.
- Manage indexes and data changes through versioned migration scripts.
- Never accept protected fields such as status, approval actor, posting actor, audit fields, or organization ID from a generic update body.
- Avoid unbounded embedded arrays. Enforce line-count limits or use child collections when volume requires them.

## Authentication requirements

The first-party React app uses Redis-backed server-side sessions.

- Store only an opaque session ID in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.
- Rotate the session after login, MFA completion, password change, and privilege change.
- Enforce inactivity and absolute session expiry.
- Support current-session logout, logout all sessions, and per-session revocation.
- Revoke sessions after password reset according to policy.
- Protect state-changing browser requests with CSRF tokens and Origin/Referer validation.
- Use an explicit CORS allow-list; never use wildcard origin with credentials.
- Never store long-lived access tokens, refresh tokens, or session secrets in `localStorage` or `sessionStorage`.
- Hash passwords with Argon2id using reviewed cost settings.
- Return generic login and password-reset responses.
- MFA is required for administrators when enabled; recovery codes are one-time hashes.

External integrations, when added, use separate scoped API clients or short-lived JWT access tokens with rotated and hashed refresh credentials. Do not reuse browser sessions as integration credentials.

## Rate limiting and abuse prevention

Use Redis-backed distributed rate limiters. Implement separate policies for:

- login by IP and normalized account;
- forgot-password by IP and destination hash;
- MFA verification by session/user and IP;
- general authenticated API by user and IP;
- search/autocomplete with query cost limits;
- stock posting with low burst plus idempotency;
- report export creation with concurrency and daily quotas;
- file uploads with count, body-size, file-size, and concurrency limits;
- health endpoints at the reverse proxy.

Thresholds are configuration, not magic literals. Return safe `429` responses and `Retry-After` when appropriate. Rate limiting does not replace lockout, idempotency, authorization, validation, or query limits.

## Authorization requirements

Use granular permissions such as:

```text
users.view users.create users.update users.activate users.deactivate
roles.view roles.manage permissions.view
organizations.view organizations.manage
departments.view departments.manage
warehouses.view warehouses.manage locations.manage
products.view products.create products.update products.archive
suppliers.view suppliers.manage
purchase_orders.view purchase_orders.create purchase_orders.update
purchase_orders.submit purchase_orders.approve purchase_orders.reject purchase_orders.cancel
receipts.view receipts.create receipts.update receipts.verify receipts.post receipts.reverse
stock_requests.view stock_requests.create stock_requests.update
stock_requests.submit stock_requests.approve stock_requests.reject stock_requests.cancel
issues.view issues.create issues.update issues.pick issues.post issues.reverse
returns.view returns.create returns.post
transfers.view transfers.create transfers.approve transfers.post transfers.reverse
adjustments.view adjustments.create adjustments.approve adjustments.post
stock_counts.view stock_counts.create stock_counts.approve stock_counts.post
inventory.view inventory.reconcile
alerts.view alerts.acknowledge alerts.resolve
reports.view reports.export
audit.view settings.manage operations.view
```

For every protected action enforce:

1. valid authenticated session;
2. active user and organization membership;
3. required permission;
4. organization scope;
5. department/warehouse/location/ownership scope;
6. valid document status;
7. separation-of-duty policy;
8. MFA/re-authentication level when required.

Never hard-code role names in controllers. Never rely on hidden UI controls. Test every denied path.

## API requirements

- Prefix routes with `/api/v1`.
- Use consistent success and error envelopes.
- Use decimal strings for quantity and money.
- Include pagination metadata.
- Require `Idempotency-Key` on stock posting.
- Use correlation IDs.
- Return field-level validation errors.
- Use `401`, `403`, `404`, `409`, `422`, and `429` consistently.
- Do not expose stack traces, MongoDB queries, internal paths, secrets, or raw exception messages.
- Use allow-listed filters and sort fields; cap page size and query complexity.
- Never pass raw `req.body`, `req.query`, or client filter objects to MongoDB.

## Security middleware and headers

Configure and test:

- proxy trust according to deployment topology;
- Helmet or equivalent security headers;
- Content Security Policy;
- HSTS in production;
- frame restrictions;
- MIME sniffing protection;
- safe referrer policy;
- explicit CORS allow-list;
- CSRF protection;
- body-size limits;
- request timeout and graceful shutdown;
- sanitized error handler;
- structured logging with secret redaction.

## File upload rules

- Allow only documented file types.
- Validate extension, declared MIME, and file signature/content.
- Enforce per-file and total request size.
- Use random object keys; never trust user paths or filenames.
- Store privately outside the web root.
- Malware-scan when supported.
- Use signed, short-lived downloads after authorization.
- Do not log file content or private signed URLs.

## Audit rules

Audit at minimum:

- login success/failure, logout, lockout, reset, MFA, and session revocation;
- user, role, permission, and scope changes;
- product and supplier changes;
- purchase-order submit/approve/reject/cancel;
- receipt, issue, return, transfer, adjustment, and count posting/reversal;
- report/export creation and download;
- settings, migration, backup, and operational changes.

Audit records are append-only for application users. Include actor, time, action, permission, resource, outcome, reason, correlation ID, and safe changed-field summary. Exclude passwords, hashes, tokens, cookies, MFA secrets, authorization headers, and full sensitive payloads.

## Frontend rules

- Use React + TypeScript with feature-based modules.
- Use a server-state query library; do not duplicate server state in global stores without need.
- Use schema-backed forms and accessible components.
- Preserve decimal inputs as strings.
- Route guards are UX only; backend authorization is authoritative.
- Show confirmation and reason capture for posting, approval, reversal, archive, and material adjustment.
- Posted documents are read-only and show their ledger and audit timeline.
- Provide loading, empty, error, forbidden, and conflict states.
- Do not expose secrets, internal error details, or unnecessary permission metadata in the browser bundle.

## Background job rules

- Queue only after the database transaction commits.
- Job payloads contain IDs, not full sensitive documents.
- Jobs are idempotent and have bounded retries/backoff.
- Use dead-letter handling and operational alerts.
- Scheduled jobs use a Redis distributed lock.
- Notifications, exports, PDF generation, cache refresh, and alert evaluation are asynchronous unless their result is required for transaction integrity.

## Testing rules

For every workflow include:

- happy-path test;
- validation failures;
- unauthenticated and permission-denied tests;
- organization/warehouse/ownership scope tests;
- database/index/validator invariant tests;
- status-transition tests;
- audit assertion;
- rollback assertion;
- idempotency replay test when posting;
- concurrency test when stock changes.

Mandatory inventory tests:

1. Ledger sum equals balance projection.
2. Any posting failure rolls back all related writes.
3. Posted documents cannot be modified through any application path.
4. Reversal retains the original and nets correctly.
5. Negative available stock is blocked.
6. Decimal precision is preserved.
7. Every state transition is valid and authorized.
8. One idempotency key creates one stock movement.
9. Same key with different payload returns conflict.
10. Concurrent issues cannot exceed available stock.

Run integration tests against a real MongoDB replica set and Redis service. Do not claim transaction coverage from mocks or standalone in-memory databases.

## Quality commands

Use repository scripts; expected categories are:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:security
pnpm test:e2e
pnpm build
pnpm db:migrate
pnpm db:verify-indexes
```

Do not invent passing results. Report exact commands and outcomes.

## Delivery sequence

Follow the implementation roadmap in Section 18 of `SYSTEM_DOCUMENTATION.md`. Stop after each milestone and report:

1. summary of behavior delivered;
2. files changed;
3. migrations, indexes, and validators added;
4. API/UI changes;
5. tests added and exact results;
6. security and data-integrity notes;
7. remaining risks and open decisions;
8. next recommended milestone.

## Forbidden shortcuts

- PHP, Laravel, MySQL, SQL migrations, or SQL row-lock code.
- Mutable product stock quantity as source of truth.
- JavaScript floating-point calculations for quantity or money.
- Standalone MongoDB for stock workflow integration tests.
- Long-lived browser tokens in local or session storage.
- Hard-coded role names in authorization logic.
- Disabling CSRF, rate limiting, validation, authorization, audit, or security headers.
- Editing/deleting posted ledger facts.
- Stock posting without idempotency.
- External calls inside a MongoDB transaction.
- Mass-assigning status, approval, posting, organization, or audit fields.
- Logging secrets, tokens, cookies, passwords, or sensitive request bodies.
- Catching exceptions and returning success.
- Hard deleting referenced master records.
- Shipping without monitored backups and a demonstrated restore procedure.

## Definition of done

A feature is not done until domain logic, schemas, migrations/indexes, authorization, validation, audit, safe errors, tests, frontend states, documentation, and quality gates are complete.
