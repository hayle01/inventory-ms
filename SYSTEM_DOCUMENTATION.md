# Secure MERN Inventory Management System

## Full System Design and Implementation Specification

**Architecture:** MERN modular monolith  
**Frontend:** React + TypeScript  
**Backend:** Node.js + Express + TypeScript  
**Database:** MongoDB replica set  
**Supporting services:** Redis, background workers, private object storage, email/SMS adapter  
**Document status:** Implementation-ready baseline  
**Technology baseline date:** 30 July 2026

---

## Document purpose

This document defines the product, architecture, data model, workflows, security controls, API conventions, testing strategy, deployment model, and phased implementation plan for a production-oriented Inventory Management System built with the MERN stack.

It replaces the previous PHP/Laravel and MySQL implementation assumptions. The business rules remain intact: stock movements are immutable, posting is atomic, approvals are server-enforced, negative stock is blocked by default, expiry-tracked inventory uses FEFO, non-expiry inventory uses FIFO, and every sensitive action is auditable.

The document is the product and engineering contract for the implementation. The companion `CLAUDE.md` file is the coding-agent contract for Claude Code.

## Source-derived requirements and engineering decisions

The source material requires authentication, users, products, categories, suppliers, purchases, stock receiving, stock issuing, inventory monitoring, reports, alerts, adjustments, transaction history, backups, usability, reliability, and security.

The following are explicit engineering decisions needed to make those requirements dependable in a MERN implementation:

- A TypeScript monorepo with React, Express, and shared API contracts.
- A modular monolith, not microservices, for the first production release.
- MongoDB replica-set transactions for every stock-changing workflow.
- An immutable stock ledger plus a transactional balance projection.
- Redis-backed sessions, distributed rate limiting, queues, and scheduler locks.
- Granular RBAC plus organization, department, warehouse, ownership, and status policies.
- Decimal128 database values and decimal-string API contracts; JavaScript floating-point numbers are forbidden for quantity and money calculations.
- Idempotency keys for posting endpoints and retried jobs.
- Append-only audit events written in the same transaction as critical state changes.

# 1. Executive summary

The Inventory Management System manages inventory from procurement through receiving, storage, request, approval, issue, adjustment, count, transfer, alerting, reporting, and audit.

The reference end-to-end scenario is:

1. An administrator creates the `Medicines` category, the `Box` unit, warehouses, storage locations, roles, and users.
2. A store manager creates a product with SKU, barcode, reorder level, lot tracking, and expiry tracking.
3. The manager creates and approves a purchase order for 50 boxes.
4. An inventory clerk receives 48 boxes and records the supplier lot and expiry date.
5. Posting the receipt atomically writes the receipt state, immutable positive stock transactions, stock balance projection, purchase-order received quantity, and audit event.
6. A department requester submits a request for 5 boxes.
7. An authorized manager approves the request.
8. The clerk posts the issue. The allocation service selects the earliest-expiring eligible lot.
9. The issue atomically writes immutable negative stock transactions, decrements balances, releases reservations, updates request and issue statuses, and records audit data.
10. Low-stock and expiry rules are reevaluated, and dashboards and reports reflect the committed transactions.

The ledger is the source of truth. Product documents never contain an authoritative `quantityInStock` field.

# 2. Goals, scope, and exclusions

## 2.1 Goals

- Provide accurate near-real-time inventory visibility.
- Prevent unauthorized or duplicate stock changes.
- Preserve a complete, immutable transaction history.
- Support controlled purchasing, receiving, requests, issues, returns, transfers, adjustments, and counts.
- Track lots and expiry dates when configured.
- Produce operational dashboards, filtered reports, and controlled exports.
- Remain maintainable by a small team through a modular monolith and strict module ownership.
- Operate safely with backups, restore drills, observability, and documented release procedures.

## 2.2 In scope

- Identity, authentication, sessions, MFA option, and access control.
- User, role, permission, organization, department, warehouse, and location administration.
- Categories, units, products, barcodes, suppliers, and supplier contacts.
- Purchase orders, approvals, partial receiving, direct receipts when authorized, and reversals.
- Stock requests, partial approvals, reservation, picking, issue posting, returns, and reversals.
- Immutable ledger, balances, lots, expiry, quarantine, damaged stock, and reconciliation.
- Adjustments, cycle counts, full counts, transfers, reason codes, and evidence attachments.
- Low-stock, out-of-stock, expiry, overdue-order, pending-approval, job, and backup alerts.
- Dashboards, reports, CSV/PDF exports, audit review, health information, and backup status.

## 2.3 Out of scope unless approved later

- Public e-commerce storefront.
- Point-of-sale payment processing.
- Full accounting/general-ledger functionality.
- Supplier self-service portal.
- Native mobile applications.
- Offline-first synchronization.
- Automatic forecasting or machine-learning replenishment.
- Microservices or event-sourced infrastructure.

# 3. Actors, roles, and permissions

## 3.1 Primary actors

| Actor | Responsibilities |
|---|---|
| Administrator | Users, roles, permissions, settings, organization structure, audit access, operational status |
| Store Manager | Catalog, suppliers, purchase orders, approvals, stock oversight, reports |
| Inventory Clerk | Receiving, picking, issuing, returns, counts, approved adjustments |
| Requester | Product availability search, stock requests, own request and issue history |
| Auditor/Viewer | Read-only reports, ledger, documents, and audit events within assigned scope |
| System Worker | Scheduled alerts, exports, reconciliation, notification delivery, backup checks |

## 3.2 Permission model

Permissions are granular strings. Roles are configurable bundles; controllers and UI must never hard-code role names as authorization rules.

```text
users.view users.create users.update users.activate users.deactivate
roles.view roles.manage permissions.view
organizations.view organizations.manage
departments.view departments.manage
warehouses.view warehouses.manage locations.manage
products.view products.create products.update products.archive
categories.view categories.manage units.manage
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

## 3.3 Authorization evaluation order

Every protected request must pass all applicable checks:

1. Authenticated session is valid and not revoked.
2. User status is active and organization membership is valid.
3. Required permission is present.
4. Resource belongs to the user's organization.
5. Department, warehouse, location, and ownership scope permits access.
6. Document status permits the requested action.
7. Separation-of-duty rule permits the actor to perform the action.
8. High-risk actions satisfy re-authentication or MFA requirements when enabled.

A hidden button is not authorization. Every action is enforced on the server and covered by denial tests.

# 4. Functional modules

## 4.1 Identity and Access

- Login with username or email and password.
- Logout current session and logout all sessions.
- Forgot-password and single-use reset-token flow.
- Optional MFA for privileged users.
- Temporary lockout and progressive delay after repeated failures.
- Session timeout, revocation, device/session list, and security activity.
- Generic authentication errors that do not disclose account existence.

## 4.2 User Administration

- Create, invite, edit, activate, deactivate, and archive users.
- Assign roles and direct permissions only when policy allows.
- Scope users to organization, department, warehouse, and location.
- Prevent deletion of users referenced by business records.
- Audit access changes and privilege escalation.

## 4.3 Organization, Departments, Warehouses, and Locations

- Maintain organization profile, timezone, currency, number prefixes, and feature flags.
- Maintain requesting departments.
- Maintain warehouses and storage locations.
- Classify locations as normal, quarantine, damaged, expired, or in transit.
- Configure approval thresholds, alert thresholds, and stock policies.

## 4.4 Catalog

- Categories with optional hierarchy.
- Units with symbol and permitted decimal places.
- Products with SKU, name, description, type, category, unit, barcode, purchase price, issue price, reorder settings, lot/expiry behavior, and active state.
- Search by name, SKU, barcode, or category.
- Unique SKU and barcode per organization.
- Archive referenced products; never remove transaction history.

## 4.5 Suppliers

- Supplier code, name, contacts, address, phone, email, tax identifier, status, and notes.
- Supplier purchase history, receipts, and outstanding order quantities.
- Archive inactive suppliers without deleting historical documents.

## 4.6 Procurement

- Multi-line purchase orders.
- Draft, submit, approve, reject, cancel, partially receive, fully receive, close.
- Supplier, destination warehouse, order date, expected date, quantity, cost, tax, discount, currency, and notes.
- Over-receipt blocked by default; an exceptional permission and reason may allow it.
- Optional prevention of creator self-approval.

## 4.7 Receiving and Lots

- Receive against an approved purchase order or authorized direct receipt.
- Capture received, accepted, rejected, damaged, and quarantined quantities.
- Require lot number and expiry date for products configured to track expiry.
- Support partial receipts and multiple lots for one order line.
- Verify before posting.
- Post receipt atomically and produce a printable receipt note.
- Reverse by creating an opposite transaction; posted documents are never edited.

## 4.8 Inventory Ledger and Balances

- Immutable transactions for opening balance, receipt, issue, return, adjustment, transfer, and reversal.
- Balance projection by organization, warehouse, location, product, and lot.
- On-hand, reserved, available, damaged, quarantine, and in-transit visibility.
- Reconciliation of projections against ledger sums.
- Search and filter by product, warehouse, location, lot, date, type, reference, and actor.

## 4.9 Stock Requests and Issues

- Multi-line stock requests by department or user.
- Draft, submit, approve, partially approve, reject, cancel, partially issue, fully issue, close.
- Requested, approved, reserved, issued, returned, and outstanding quantities.
- Optional reservation after approval.
- FEFO allocation for expiry-tracked products; FIFO otherwise.
- Authorized allocation override requires a reason and audit event.
- Atomic issue posting and printable issue note.

## 4.10 Returns, Transfers, Adjustments, and Counts

- Return issued stock when policy allows and preserve original lot identity.
- Transfer between locations or warehouses using paired transfer-out and transfer-in transactions.
- Optional in-transit state and receive-at-destination step.
- Adjustment drafts with reason code, evidence, approval threshold, and posting.
- Full and cycle counts with snapshot, count entry, variance approval, and variance posting.
- Material negative adjustments require stronger permission and optional MFA re-confirmation.

## 4.11 Alerts

- Low stock, out of stock, expiring soon, expired lot, overdue purchase order, pending approval, failed export/job, failed backup, and reconciliation mismatch.
- Acknowledge, resolve, assign, and comment on alerts.
- Avoid duplicate open alerts for the same type and scope.
- Optional email/SMS delivery through queued adapters.

## 4.12 Dashboards, Reports, and Exports

Administrator/manager dashboard:

- active products;
- total units and optional inventory value;
- low/out-of-stock products;
- expiring lots;
- open purchase orders;
- pending requests and approvals;
- recent stock transactions;
- operational failures.

Requester dashboard:

- searchable availability;
- request submission;
- request status;
- own issue and return history;
- profile and security settings.

Reports:

- current inventory and valuation;
- stock movement;
- purchases, receipts, and outstanding quantities;
- supplier activity;
- requests, issues, returns, and distribution;
- low stock, out of stock, expiring, and expired stock;
- adjustments and count variance;
- user activity and audit trail.

Reports query source records. The system must not copy report facts into a mutable `reports` collection. Long exports run asynchronously and produce time-limited, access-controlled files.

# 5. Non-functional requirements

## 5.1 Performance

- Common lists and searches should normally respond within two seconds under the agreed load.
- Stock posting should normally complete within three seconds.
- Large reports and exports run asynchronously.
- Query plans and indexes must be reviewed for high-volume collections.
- Avoid unbounded queries, N+1 request patterns, and returning large embedded arrays without pagination.

## 5.2 Reliability and integrity

- All stock postings are atomic and idempotent.
- No silent partial write is permitted.
- Transient MongoDB transaction conflicts are retried using a bounded strategy.
- Scheduled reconciliation detects any mismatch between ledger and balance projection.
- Backups are encrypted, monitored, retained, and restore-tested.

## 5.3 Security

- Strong password hashing, secure sessions, CSRF protection, rate limiting, lockout, optional MFA, RBAC, record scoping, TLS, encryption at rest, audit trails, secret management, dependency scanning, and least privilege.

## 5.4 Usability and accessibility

- Responsive desktop and mobile-browser layout.
- Semantic labels, keyboard navigation, visible focus states, accessible contrast, and clear validation errors.
- Search, filters, sorting, pagination, and saved filter support on major lists.
- Confirmation and reason capture for destructive, approval, posting, reversal, and adjustment actions.
- Posted documents are visibly read-only and show timeline/audit history.

## 5.5 Maintainability

- TypeScript strict mode.
- Modular boundaries and dependency direction checks.
- Shared request/response schemas.
- Automated formatting, linting, type checking, tests, and security scans.
- Versioned API, migrations, seed scripts, documentation, release notes, and rollback plans.

# 6. Architecture

## 6.1 Architecture decision

Use a modular monolith. The system has one product and one deployment boundary, but code is divided into bounded modules. This is appropriate because receiving, issuing, adjustment, transfer, balances, alerts, and audit share strong transaction requirements.

Microservices are explicitly deferred. Service extraction is considered only when a proven scaling or ownership need cannot be solved within the modular monolith.

## 6.2 Runtime topology

```text
Browser
  -> HTTPS reverse proxy / load balancer
      -> React static assets
      -> Express API instances
           -> MongoDB replica set / managed cluster
           -> Redis session, rate-limit, cache, queue
           -> Private object storage
           -> Email/SMS provider
      -> Worker processes
           -> Redis queues
           -> MongoDB
           -> Object storage
      -> Scheduler process with distributed lock

All processes -> centralized logs, metrics, traces, and alerts
```

## 6.3 Technology baseline

| Area | Decision |
|---|---|
| Language | TypeScript, strict mode, shared compiler configuration |
| Frontend | React stable release pinned in the repository, Vite, React Router, TanStack Query, React Hook Form, schema validation |
| Backend | Supported Node.js LTS release pinned in the repository, supported Express release, TypeScript strict mode |
| Database | MongoDB managed replica set or sharded cluster with transaction support |
| ODM | Mongoose or the official MongoDB Node.js driver behind repositories; choose one consistently |
| Session/cache/queue | Redis-compatible managed service |
| Jobs | BullMQ-compatible queue workers or equivalent Redis queue abstraction |
| Validation | Zod-compatible schemas shared at boundaries; database validators for critical fields |
| Decimal arithmetic | Decimal library in application code; MongoDB Decimal128 in storage |
| Logging | Structured JSON logger with automatic secret/header redaction |
| Testing | Unit, API/integration, browser E2E, security, performance, restore tests |
| Packaging | pnpm workspace monorepo and locked dependencies |
| Local environment | Docker Compose with MongoDB replica set, Redis, and object storage emulator; outbound email uses real SMTP via nodemailer (`MAIL_HOST` unset disables sending and logs a warning instead) |

Exact package versions are pinned in the repository lockfile and updated through reviewed dependency pull requests.

## 6.4 Logical layers

### Presentation

- Express routers and controllers.
- Request parsing and schema validation.
- Authentication and authorization middleware.
- API presenters/serializers.
- React routes, pages, components, forms, and query hooks.

### Application

- Use-case services such as `CreatePurchaseOrder`, `PostGoodsReceipt`, `ApproveStockRequest`, and `PostStockIssue`.
- Transaction orchestration.
- Idempotency handling.
- Authorization context.
- Commands, queries, and after-commit job dispatch.

### Domain

- Status state machines.
- Stock availability and allocation.
- FEFO/FIFO policy.
- Approval and separation-of-duty rules.
- Over-receipt and negative-stock policy.
- Reversal rules.
- Decimal calculations.
- Ledger invariants.

### Infrastructure

- MongoDB models/repositories.
- Redis session, cache, rate-limit, and queue adapters.
- Object storage, email, SMS, logging, metrics, and secrets adapters.
- Database migrations and indexes.

## 6.5 Monorepo structure

```text
apps/
  web/
    src/app/
    src/features/
    src/components/
    src/routes/
    src/lib/
  api/
    src/modules/
      identity/
      access/
      organization/
      catalog/
      suppliers/
      procurement/
      receiving/
      inventory/
      requests/
      issues/
      returns/
      transfers/
      adjustments/
      counts/
      alerts/
      reporting/
      audit/
      operations/
    src/shared/
      application/
      domain/
      infrastructure/
      http/
      security/
      observability/
  worker/
    src/jobs/
    src/schedulers/
packages/
  contracts/
  config/
  eslint-config/
  tsconfig/
  ui/
infra/
  docker/
  compose/
  deployment/
docs/
  adr/
  runbooks/
tests/
  e2e/
CLAUDE.md
README.md
```

Controllers remain thin. Modules may depend on shared abstractions, but modules must not reach into another module's database model directly. Cross-module work is performed through exported application services or explicit domain contracts.

# 7. Inventory integrity and MongoDB transaction design

## 7.1 Non-negotiable invariants

1. Every quantity change creates one or more immutable `stockTransactions` documents.
2. The source document, ledger, balance projection, and audit event are committed in one MongoDB transaction.
3. `stockTransactions` is authoritative; `stockBalances` is a transactional read projection.
4. Products do not store authoritative stock quantity.
5. Negative available stock is blocked by default.
6. Posted documents and ledger facts are never edited or deleted.
7. Corrections use linked reversal, return, or adjustment documents.
8. Lot and expiry are mandatory when the product configuration requires them.
9. FEFO is used for expiry-tracked issues and FIFO otherwise.
10. Quantity and money never use JavaScript binary floating-point arithmetic.
11. Posting endpoints and retried jobs are idempotent.
12. Reconciliation must prove that ledger sums equal balance projections.

## 7.2 MongoDB requirements

- Development, test, staging, and production use a replica set or compatible managed cluster; a standalone MongoDB server is not acceptable for stock transaction tests.
- Multi-document writes use `session.withTransaction` or an equivalent transaction wrapper.
- Transaction operations execute sequentially; do not use `Promise.all` inside a transaction.
- Use primary read preference, appropriate snapshot read concern, and majority write concern for critical posting.
- Retry only recognized transient transaction or unknown-commit-result conditions, with a bounded attempt count and correlation logging.
- Keep transactions short. External calls, file uploads, PDF generation, and notification delivery happen outside the transaction after commit.

## 7.3 Balance key and unique index

A balance is uniquely identified by:

```text
organizationId + warehouseId + locationId + productId + lotId-or-null + stockState
```

Create a unique compound index over the normalized key. Do not rely on application-only uniqueness.

## 7.4 Conditional stock decrement

For issue posting, each allocated balance is updated with a predicate that proves sufficient available quantity and the expected version. Example conceptual operation:

```text
findOneAndUpdate(
  key + status constraints + availableQuantity >= requested + version == expected,
  $inc onHand/reserved and $inc version,
  within session
)
```

Failure to match is a business conflict. The transaction aborts, availability is recalculated, and the API returns a safe `409` or `422` response. For multi-lot allocation, acquire/update candidate balances in deterministic order to reduce write conflicts.

## 7.5 Decimal handling

- Store quantities and money as BSON Decimal128.
- Receive decimal values as validated strings in API requests.
- Serialize decimal values as strings in API responses.
- Use a decimal arithmetic library for calculations.
- Never convert inventory quantities, prices, tax, discounts, or totals through `Number`, `parseFloat`, or implicit numeric coercion.
- Normalize scale according to the unit and currency rules before persistence.

## 7.6 Idempotency

Posting operations require an `Idempotency-Key` header.

The `idempotencyRecords` collection stores:

- organization and operation scope;
- key hash;
- request fingerprint;
- status: processing, succeeded, failed-retryable, failed-final;
- response status and safe response body;
- source document reference;
- expiry timestamp.

A unique index on scope and key prevents duplicates. Reuse with a different request fingerprint returns `409`. A successful replay returns the original safe result without writing a second stock movement.

## 7.7 Reconciliation

A scheduled job aggregates signed ledger quantities by balance key and compares them with `stockBalances`.

- Matching keys are marked healthy.
- Missing, extra, or mismatched balances create a critical alert.
- The job never silently overwrites balances in production.
- Repair requires an authorized, documented reconciliation procedure with evidence and audit events.

# 8. Data model

## 8.1 Modeling conventions

- Use MongoDB ObjectId consistently for internal IDs.
- Use human-readable codes/document numbers for business records.
- All organization-owned documents contain `organizationId` and are queried with organization scope.
- Timestamps are UTC; the UI displays the organization timezone.
- Master data is archived with `archivedAt` and status fields.
- Sensitive status and audit fields are excluded from general update DTOs.
- Critical collections use JSON Schema validators in addition to application validation.
- Index names, purpose, uniqueness, and cardinality are documented and migration-managed.

## 8.2 Identity collections

### users

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `organizationId` | ObjectId | Required, indexed |
| `fullName` | string | Required, trimmed |
| `usernameNormalized` | string | Required, unique per organization |
| `emailNormalized` | string | Required, unique per organization |
| `passwordHash` | string | Argon2id hash, never returned |
| `status` | string | invited, active, locked, inactive, archived |
| `departmentId` | ObjectId/null | Optional requester scope |
| `warehouseScopes` | ObjectId[] | Optional scope list |
| `roleIds` | ObjectId[] | Role assignment |
| `directPermissionIds` | ObjectId[] | Exceptional direct grants |
| `mfa` | object | Encrypted secret reference, recovery-code hashes, enabled state |
| `failedLoginCount` | integer | Security counter |
| `lockedUntil` | date/null | Temporary lock |
| `lastLoginAt` | date/null | UTC |
| `passwordChangedAt` | date | Session invalidation boundary |
| `createdBy`, `updatedBy` | ObjectId/null | Traceability |
| `createdAt`, `updatedAt`, `archivedAt` | date | UTC |

Indexes: unique `(organizationId, usernameNormalized)` and `(organizationId, emailNormalized)`; status and department indexes.

### roles

`organizationId`, `name`, `description`, `permissionIds`, `isSystem`, timestamps, archive fields. Unique `(organizationId, name)`.

### permissions

`name`, `description`, `module`, `riskLevel`, timestamps. Permission names are globally unique.

### authSessions

`userId`, `organizationId`, `sessionIdHash`, `createdAt`, `lastSeenAt`, `expiresAt`, `absoluteExpiresAt`, `ipHash`, `userAgentSummary`, `mfaLevel`, `revokedAt`, `revokeReason`. TTL index on expiry.

### passwordResetTokens

`userId`, `tokenHash`, `createdAt`, `expiresAt`, `usedAt`, `requestIpHash`. TTL index on expiry; raw token is never stored.

## 8.3 Organization and location collections

### organizations

`code`, `name`, `timezone`, `currencyCode`, `status`, `settings`, timestamps.

### departments

`organizationId`, `code`, `name`, `managerUserId`, `status`, timestamps. Unique `(organizationId, code)`.

### warehouses

`organizationId`, `code`, `name`, `address`, `isDefault`, `status`, timestamps. Unique `(organizationId, code)`.

### storageLocations

`organizationId`, `warehouseId`, `code`, `name`, `locationType`, `status`, timestamps. Unique `(warehouseId, code)`.

## 8.4 Catalog collections

### categories

`organizationId`, `parentId`, `code`, `name`, `description`, `status`, timestamps. Unique `(organizationId, code)`.

### units

`organizationId`, `code`, `name`, `symbol`, `decimalPlaces`, `status`, timestamps. Unique `(organizationId, code)`.

### products

| Field | Type | Rules |
|---|---|---|
| `organizationId` | ObjectId | Required |
| `categoryId` | ObjectId | Required |
| `unitId` | ObjectId | Required |
| `sku` | string | Unique per organization |
| `name` | string | Required |
| `description` | string/null | Optional |
| `productType` | string | consumable, medicine, equipment, other |
| `purchasePrice` | Decimal128 | Non-negative |
| `issuePrice` | Decimal128/null | Non-negative |
| `reorderLevel` | Decimal128 | Default zero |
| `reorderQuantity` | Decimal128/null | Optional |
| `trackLots` | boolean | Configuration |
| `trackExpiry` | boolean | Implies lot tracking |
| `expiryWarningDays` | integer | Non-negative |
| `allowNegativeStock` | boolean | Default false; exceptional policy only |
| `status` | string | active, inactive, archived |
| `createdBy`, `updatedBy` | ObjectId | Traceability |
| timestamps | date | UTC |

No authoritative stock field is permitted.

### productBarcodes

`organizationId`, `productId`, `barcode`, `barcodeType`, `isPrimary`, timestamps. Unique `(organizationId, barcode)`.

## 8.5 Supplier collections

### suppliers

`organizationId`, `code`, `name`, address fields, phone, email, tax identifier, status, notes, timestamps. Unique `(organizationId, code)`.

### supplierContacts

`organizationId`, `supplierId`, `name`, `jobTitle`, `phone`, `email`, `isPrimary`, timestamps.

## 8.6 Procurement collections

### purchaseOrders

| Field | Type | Rules |
|---|---|---|
| `organizationId` | ObjectId | Required |
| `poNumber` | string | Unique per organization |
| `supplierId` | ObjectId | Required |
| `warehouseId` | ObjectId | Delivery destination |
| `status` | string | State machine |
| `orderDate`, `expectedDate` | date/null | Business dates |
| `currencyCode` | string | ISO currency code |
| `subtotal`, `tax`, `discount`, `total` | Decimal128 | Derived and validated |
| `items` | embedded array | Bounded line items |
| `notes` | string/null | Optional |
| actor/timestamp fields | ObjectId/date | creator, submitter, approver, rejection/cancellation |
| `version` | integer | Optimistic concurrency |
| timestamps | date | UTC |

Each embedded item includes line number, product ID, description snapshot, ordered quantity, received quantity, unit cost, tax, discount, and line total. Unique `(organizationId, poNumber)`.

Purchase-order item arrays must have a configured maximum line count. If expected volume exceeds that bound, use a separate `purchaseOrderItems` collection while preserving the same contract.

## 8.7 Receiving and lot collections

### goodsReceipts

`organizationId`, `receiptNumber`, `purchaseOrderId`, `supplierId`, `warehouseId`, `status`, `receivedDate`, supplier document number, items, notes, creator/verifier/poster/reverser fields, `reversalOfId`, `version`, timestamps.

Each receipt item includes product, PO line reference, destination location, quantities received/accepted/rejected, unit cost, lot number, manufactured date, expiry date, condition, and notes.

Constraint: accepted plus rejected equals received. Expiry-tracked accepted quantity requires lot and expiry.

### inventoryLots

`organizationId`, `productId`, `supplierId`, `lotNumber`, `manufacturedAt`, `expiresAt`, `receivedAt`, `status`, timestamps. Unique `(organizationId, productId, lotNumber)` when a lot number exists.

## 8.8 Ledger and balance collections

### stockTransactions

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | Immutable |
| `organizationId` | ObjectId | Indexed |
| `transactionNumber` | string | Unique business ID |
| `transactionType` | string | opening, receipt, issue, return, adjustment, transfer, reversal |
| `transactionAt` | date | Business time |
| `productId` | ObjectId | Required |
| `warehouseId` | ObjectId | Required |
| `locationId` | ObjectId | Required |
| `lotId` | ObjectId/null | Required when tracked |
| `stockState` | string | available, quarantine, damaged, expired, in_transit |
| `quantity` | Decimal128 | Signed; positive in, negative out |
| `unitCost` | Decimal128/null | Optional valuation basis |
| `referenceType` | string | Source document type |
| `referenceId` | ObjectId | Source document ID |
| `referenceNumber` | string | Human-readable reference snapshot |
| `reasonCode` | string/null | Required for adjustment/reversal |
| `idempotencyKeyHash` | string | Posting trace |
| `createdBy` | ObjectId | Actor |
| `correlationId` | string | Request trace |
| `createdAt` | date | Immutable UTC timestamp |

Indexes support product/date, warehouse/date, lot/date, reference, transaction number, and reconciliation aggregation.

### stockBalances

`organizationId`, `warehouseId`, `locationId`, `productId`, `lotId`, `stockState`, `onHandQuantity`, `reservedQuantity`, `version`, `lastTransactionAt`, `updatedAt`.

Available quantity is derived as `onHandQuantity - reservedQuantity` for issuable stock states. Unique compound key as defined in section 7.3.

## 8.9 Request and issue collections

### stockRequests

`organizationId`, `requestNumber`, `requesterUserId`, `departmentId`, `warehouseId`, `status`, needed date, priority, items, notes, actor/timestamp fields, version, timestamps.

Each item contains requested, approved, reserved, issued, returned, and outstanding decimal quantities plus approval notes.

### stockIssues

`organizationId`, `issueNumber`, `stockRequestId`, `departmentId`, `warehouseId`, `status`, items, picked allocations, notes, actor/timestamp fields, reversal link, version, timestamps.

Each allocation records product, lot, location, quantity, expiry, policy used, and override reason when applicable.

### stockReturns

`organizationId`, `returnNumber`, `stockIssueId`, status, items, condition, destination stock state, reason, poster, timestamps.

## 8.10 Transfer, adjustment, and count collections

### stockTransfers

`organizationId`, `transferNumber`, source/destination warehouse and location, status, items, in-transit policy, actor/timestamp fields, reversal link, version, timestamps.

### stockAdjustments

`organizationId`, `adjustmentNumber`, warehouse/location, status, reason code, items, evidence files, approval requirement snapshot, actor/timestamp fields, reversal link, version, timestamps.

### stockCounts

`organizationId`, `countNumber`, scope, status, snapshot time, blind-count flag, items, variance totals, actor/timestamp fields, version, timestamps.

## 8.11 Operational collections

### alerts

`organizationId`, type, severity, scope fields, status, title, message, deduplication key, first/last detected times, acknowledged/resolved fields, metadata, timestamps. Unique partial index prevents duplicate open alerts.

### auditEvents

`organizationId`, actor ID/type, action, resource type/ID/number, timestamp, correlation ID, IP hash, user-agent summary, permission used, outcome, safe changed-field summary, reason, metadata. Append-only. No password, token, cookie, secret, or full sensitive payload.

### reportExports

`organizationId`, report type, filters, format, status, creator, object key, checksum, size, expiresAt, failure code, timestamps. TTL cleanup after expiry where appropriate.

### idempotencyRecords

As defined in section 7.6, with TTL and unique scope/key index.

### jobRuns and backupRuns

Job name, schedule/run IDs, start/end, status, safe metrics, failure code, artifact/checksum references, and timestamps.

# 9. Status models

## 9.1 Purchase order

```text
draft -> submitted -> approved -> partially_received -> fully_received -> closed
              \-> rejected
approved/draft/submitted -> cancelled when policy allows
```

## 9.2 Goods receipt

```text
draft -> verified -> posted -> reversed
             \-> cancelled before posting
```

## 9.3 Stock request

```text
draft -> submitted -> approved/partially_approved -> partially_issued -> fully_issued -> closed
                  \-> rejected
non-posted states -> cancelled when policy allows
```

## 9.4 Stock issue

```text
draft -> picked -> posted -> reversed
           \-> cancelled before posting
```

## 9.5 Adjustment and count

```text
draft -> submitted -> approved -> posted -> reversed
                    \-> rejected
```

All transitions are defined in domain state-machine functions and tested. Generic PATCH endpoints cannot change workflow status.

# 10. API design

## 10.1 Conventions

- Prefix all application APIs with `/api/v1`.
- JSON request and response bodies.
- Decimal quantity and money fields are strings.
- UTC ISO-8601 timestamps.
- Cursor pagination is preferred for large ledger and audit collections; page pagination is acceptable for bounded administration lists.
- Support documented filtering, sorting, and field selection only.
- Use correlation IDs for every request.
- Posting endpoints require `Idempotency-Key`.
- Never expose stack traces, Mongo queries, internal paths, tokens, or secret values.

## 10.2 Success envelope

```json
{
  "data": {},
  "meta": {
    "correlationId": "01J..."
  }
}
```

Collection response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "perPage": 25,
    "total": 120,
    "hasNext": true,
    "correlationId": "01J..."
  }
}
```

## 10.3 Error envelope

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "The requested quantity is not available.",
    "details": {
      "productId": "...",
      "requested": "5.0000",
      "available": "3.0000"
    },
    "correlationId": "01J..."
  }
}
```

Use:

- `400` malformed request;
- `401` unauthenticated;
- `403` authenticated but forbidden;
- `404` not found or hidden by scope;
- `409` duplicate, stale version, or state conflict;
- `422` validated request that violates a business rule;
- `429` rate limit;
- `500` unexpected safe error.

## 10.4 Endpoint map

### Authentication and profile

```text
POST /auth/login
POST /auth/logout
POST /auth/logout-all
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/mfa/challenge
POST /auth/mfa/verify
GET  /me
GET  /me/sessions
DELETE /me/sessions/:sessionId
PATCH /me/profile
PATCH /me/password
```

### Users and access

```text
GET/POST /users
GET/PATCH /users/:id
POST /users/:id/activate
POST /users/:id/deactivate
POST /users/:id/archive
GET/POST /roles
GET/PATCH /roles/:id
GET /permissions
```

### Organization and catalog

```text
GET/PATCH /organization
GET/POST /departments
GET/POST /warehouses
GET/POST /warehouses/:warehouseId/locations
GET/POST /categories
GET/POST /units
GET/POST /products
GET/PATCH /products/:id
POST /products/:id/archive
GET /products/search
GET /products/:id/availability
```

### Suppliers and procurement

```text
GET/POST /suppliers
GET/PATCH /suppliers/:id
POST /suppliers/:id/archive
GET/POST /purchase-orders
GET/PATCH /purchase-orders/:id
POST /purchase-orders/:id/submit
POST /purchase-orders/:id/approve
POST /purchase-orders/:id/reject
POST /purchase-orders/:id/cancel
POST /purchase-orders/:id/close
```

### Receiving

```text
GET/POST /goods-receipts
GET/PATCH /goods-receipts/:id
POST /goods-receipts/:id/verify
POST /goods-receipts/:id/post
POST /goods-receipts/:id/reverse
```

### Requests, issues, and returns

```text
GET/POST /stock-requests
GET/PATCH /stock-requests/:id
POST /stock-requests/:id/submit
POST /stock-requests/:id/approve
POST /stock-requests/:id/reject
POST /stock-requests/:id/cancel
GET/POST /stock-issues
GET/PATCH /stock-issues/:id
POST /stock-issues/:id/pick
POST /stock-issues/:id/post
POST /stock-issues/:id/reverse
GET/POST /stock-returns
POST /stock-returns/:id/post
```

### Inventory, transfers, adjustments, and counts

```text
GET /inventory/balances
GET /inventory/availability
GET /inventory/transactions
GET /inventory/lots
POST /inventory/reconcile
GET/POST /stock-transfers
POST /stock-transfers/:id/submit
POST /stock-transfers/:id/approve
POST /stock-transfers/:id/post
POST /stock-transfers/:id/receive
POST /stock-transfers/:id/reverse
GET/POST /stock-adjustments
POST /stock-adjustments/:id/submit
POST /stock-adjustments/:id/approve
POST /stock-adjustments/:id/post
GET/POST /stock-counts
POST /stock-counts/:id/start
POST /stock-counts/:id/submit
POST /stock-counts/:id/approve
POST /stock-counts/:id/post
```

### Alerts, reports, audit, and operations

```text
GET /alerts
POST /alerts/:id/acknowledge
POST /alerts/:id/resolve
GET /reports/inventory
GET /reports/stock-movement
GET /reports/purchases
GET /reports/issues
GET /reports/low-stock
GET /reports/expiry
GET /reports/audit
POST /report-exports
GET /report-exports/:id
GET /report-exports/:id/download
GET /audit-events
GET /operations/health
GET /operations/version
GET /operations/job-runs
GET /operations/backup-runs
```

# 11. Core workflows

## 11.1 Purchase order to receipt

1. Manager creates a draft PO.
2. Server validates supplier, warehouse, active products, positive decimal quantities, prices, and line uniqueness.
3. Manager submits.
4. Authorized approver approves; separation-of-duty rules are checked.
5. Clerk creates a receipt referencing outstanding PO quantities.
6. Expiry-tracked items require lot and expiry.
7. Clerk verifies.
8. Clerk posts with an idempotency key.
9. Server begins a MongoDB transaction.
10. Revalidate session, permission, scope, document version, PO status, line quantities, and idempotency record.
11. Create or resolve inventory-lot documents.
12. Upsert/increment balance documents.
13. Insert immutable positive stock transactions.
14. Update PO received quantities and receipt status.
15. Insert audit event and finalize idempotency result.
16. Commit.
17. Queue low-stock/expiry evaluation, notifications, and optional document generation after commit.

Any failure before commit leaves no partial ledger, balance, document, or audit state.

## 11.2 Request to issue

1. Requester creates and submits a request.
2. Manager approves all or part after checking scope and policy.
3. Optional reservation increments `reservedQuantity` transactionally.
4. Clerk creates an issue from approved outstanding lines.
5. Allocation service selects eligible lots by expiry date then received date for FEFO, or received date for FIFO.
6. Clerk confirms picked quantities.
7. Post begins a transaction and rechecks authorization, versions, status, lot eligibility, and available quantity.
8. Balance decrements use conditional updates.
9. Insert immutable negative stock transactions.
10. Release reservations and update request/issue quantities and statuses.
11. Insert audit event and commit.
12. Queue alerts and notifications after commit.

Expired, quarantined, damaged, or blocked lots are not issuable unless a separately authorized workflow changes their state.

## 11.3 Adjustment

1. Clerk creates a draft and selects a reason code.
2. System shows current quantity and lot/location context.
3. Clerk enters delta or counted quantity plus evidence.
4. Policy calculates approval requirement based on absolute quantity/value and reason.
5. Authorized approver approves.
6. Posting creates signed adjustment transactions and updates balances in one transaction.
7. Audit records prior quantity, delta, resulting quantity, reason, approver, and poster.

## 11.4 Reversal

- Authorized actor supplies a reason.
- Original posted document remains immutable.
- Server creates a linked reversal document.
- Opposite signed ledger transactions are inserted.
- Balance and upstream/downstream quantities are recalculated safely.
- The original is marked reversed only through the controlled reversal service.
- Reversal itself can be further corrected only through a documented compensating action.

## 11.5 Transfer

- Source and destination are distinct and valid.
- Preserve product, lot, expiry, and stock state identity.
- Immediate transfer posts transfer-out and transfer-in in one transaction.
- In-transit transfer posts source-out/in-transit first and destination receipt later, each with controlled states and reconciliation.

## 11.6 Low-stock alert

- Evaluate after relevant transaction commit and in scheduled reconciliation.
- Aggregate configured available quantity scope.
- Open or reopen when available is less than or equal to reorder level.
- Resolve when above threshold.
- Unique deduplication key prevents duplicate open alerts.

## 11.7 Expiry alert

- Daily scheduler finds active lots with positive issuable balance and expiry within the configured warning window.
- Severity increases as expiry approaches.
- Expired lots are blocked from issue.
- Movement to expired/quarantine state uses an authorized stock-state workflow and ledger entries when quantity state changes.

# 12. Frontend design

## 12.1 Route map

```text
/login /forgot-password /reset-password /mfa
/dashboard
/users /roles
/organization /departments /warehouses /locations
/products /categories /units
/suppliers
/purchase-orders /goods-receipts
/stock-requests /stock-issues /stock-returns
/inventory/balances /inventory/transactions /inventory/lots
/stock-transfers /stock-adjustments /stock-counts
/alerts
/reports/*
/audit
/settings
/operations
/profile /security/sessions
```

## 12.2 UI rules

- Route guards improve UX but never replace server authorization.
- Server state is managed through a query/mutation layer with cache invalidation after successful mutations.
- Forms use shared schemas or generated compatible schemas.
- Mutations disable duplicate submission, but backend idempotency remains mandatory.
- Decimal inputs are strings and preserve scale.
- Destructive or stock-changing actions require explicit confirmation and reason where applicable.
- Status badges use text and icon, not color alone.
- Tables support responsive alternatives, keyboard navigation, pagination, sorting, and filters.
- Error pages show safe correlation IDs for support.
- Do not expose internal permission names or sensitive exception details unnecessarily.

## 12.3 Posted document presentation

Posted receipts, issues, transfers, adjustments, and count postings are read-only. Their detail screen shows:

- document number and status;
- business dates;
- line items and allocations;
- creator, verifier, approver, and poster;
- related ledger entries;
- reversal link and reason;
- audit timeline;
- printable/downloadable document when permitted.

# 13. Security architecture

## 13.1 Security objectives

Protect credentials, sessions, supplier/contact data, inventory accuracy, transaction history, exports, backups, and service availability. The highest risks are account takeover, broken access control, fraudulent stock changes, duplicate posting, race conditions, secret leakage, malicious files, data loss, and unavailable inventory information.

## 13.2 Browser authentication

The first-party React application uses server-side sessions rather than long-lived JWTs in browser storage.

- Opaque session identifier in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.
- Redis-backed session store with inactivity and absolute expiry.
- Session identifier rotated after login, MFA completion, password change, and privilege change.
- Session records are revocable individually or globally.
- Password reset revokes existing sessions according to policy.
- CSRF protection on state-changing requests using a server-issued token plus Origin/Referer checks.
- CORS allow-list is explicit; credentials are never enabled for wildcard origins.
- Production cookies are secure and scoped narrowly.

Long-lived authentication secrets must not be stored in `localStorage` or `sessionStorage`.

## 13.3 External API authentication

When integrations are introduced, use separately managed API clients with scoped credentials or short-lived JWT access tokens. Refresh credentials are rotated, hashed at rest, revocable, audience-bound, and never reused for browser login.

## 13.4 Password and MFA controls

- Argon2id password hashing with reviewed cost parameters.
- Length-focused password policy and breached-password screening where available.
- Constant-time verification behavior through the password library.
- Generic login and reset responses.
- MFA required for administrators and configurable for managers.
- Recovery codes are one-time and stored as hashes.
- MFA secrets are encrypted using a managed key.

## 13.5 Rate limiting and abuse controls

Use Redis-backed distributed limits so all API instances share counters. Limit responses use safe `429` errors and `Retry-After` where appropriate.

| Endpoint group | Example policy |
|---|---|
| Login | Per IP and normalized account; low burst; progressive delay; temporary account lock |
| Forgot password | Per IP and destination hash; always generic response |
| MFA verification | Per session/user and IP; strict attempts |
| General authenticated API | Per user and IP; moderate burst and sustained window |
| Search/autocomplete | Separate higher read allowance with query length limits |
| Posting endpoints | Low burst per user/organization plus idempotency requirement |
| Export creation | Low concurrent and daily quota per user/organization |
| File upload | Request count, body-size, file-size, and concurrent-scan limits |
| Health endpoint | Reverse-proxy limit; no sensitive details |

The exact thresholds are environment configuration, load-tested, monitored, and documented. Rate limiting does not replace account lockout, idempotency, authorization, or query-cost controls.

## 13.6 Authorization

- Permission middleware checks the required action.
- Policy services enforce organization, department, warehouse, ownership, status, and separation of duty.
- Every repository query accepts an authorization scope and includes organization criteria.
- Sensitive bulk operations re-check each resource or use a safe scoped predicate.
- `404` may be used to hide out-of-scope resource existence.
- Permission changes invalidate or rotate affected sessions.

## 13.7 Input, query, and output security

- Validate params, query, headers, and body using allow-list schemas.
- Reject unknown protected fields.
- Prevent Mongo operator injection by schema parsing and by never passing raw client objects to queries.
- Escape output through React by default; prohibit unsafe HTML unless sanitized with a reviewed library.
- Limit body size, query length, page size, sort fields, filter fields, regex usage, and aggregation complexity.
- Use safe projection allow-lists; never serialize Mongoose/internal fields or password/security fields.
- Apply Content Security Policy, HSTS, frame restrictions, MIME sniffing protection, and referrer policy.

## 13.8 File security

- Accept only explicitly allowed MIME types and extensions.
- Verify file signatures/content, not only client MIME metadata.
- Enforce file and total request size.
- Generate random object keys; do not use user-supplied paths.
- Store in private object storage, never in the public web root.
- Malware-scan when infrastructure supports it.
- Provide signed, short-lived download URLs only after authorization.
- Strip active content or metadata when required by policy.

## 13.9 Logging and audit safety

Application logs must redact:

- passwords and password hashes;
- reset tokens and MFA secrets;
- cookies and session identifiers;
- authorization headers and API keys;
- private object-storage URLs;
- full sensitive request bodies;
- unnecessary personal data.

Audit events contain business accountability, not secrets. Log access is restricted and retained according to policy.

## 13.10 Database security

- MongoDB is not exposed publicly unless protected by a private network and strict access controls.
- TLS is required for database connections.
- Application, migration, backup, and analytics identities are separate and least-privileged.
- Collection validators and unique indexes enforce critical invariants.
- Direct production changes are restricted and audited.
- Backup credentials cannot modify the live application database.

## 13.11 Secrets and supply chain

- Secrets come from a secrets manager or protected environment variables.
- No production secret is committed, logged, or embedded in frontend bundles.
- CI performs secret scanning, dependency review, static analysis, tests, and container scanning.
- Lockfiles are committed.
- Dependency updates are reviewed and tested.
- Build artifacts are traceable to a commit and release identifier.

# 14. Background jobs and events

Synchronous transaction work:

- validation and authorization;
- idempotency registration;
- source document update;
- ledger insertion;
- balance update;
- reservation update;
- audit event.

After-commit queued work:

- email/SMS notification;
- report/export generation;
- PDF document generation;
- dashboard cache invalidation;
- low-stock and expiry evaluation;
- integration delivery;
- non-critical analytics.

Jobs are idempotent, versioned, retryable with bounded attempts, and dead-lettered after final failure. Job payloads contain IDs, not entire sensitive documents. Scheduler jobs use a distributed lock to prevent duplicate execution.

# 15. Testing strategy

## 15.1 Unit tests

- status transitions;
- FEFO/FIFO allocation;
- decimal arithmetic and rounding;
- permission mapping and policy decisions;
- document-number generation;
- alert rules;
- adjustment direction and thresholds;
- request/approval quantity constraints.

## 15.2 API and integration tests

- login, logout, reset, MFA, session rotation, and revocation;
- CRUD and archive behavior;
- permission denial and record scope;
- submit/approve/reject/cancel transitions;
- receipt, issue, return, transfer, adjustment, count, and reversal;
- MongoDB transaction rollback;
- concurrent issue conflict;
- duplicate idempotency replay;
- Redis session, rate-limit, queue, and lock behavior;
- object-storage export authorization;
- scheduled jobs and reconciliation.

Integration tests must run against a MongoDB replica set, not an in-memory mock that cannot prove transaction behavior.

## 15.3 Browser E2E tests

- administrator setup;
- product and supplier creation;
- PO approval to partial receipt;
- request approval to FEFO issue;
- low-stock and expiry alerts;
- report export and download;
- reversal and audit review;
- keyboard and core accessibility flows.

## 15.4 Minimum acceptance matrix

| ID | Scenario | Expected result |
|---|---|---|
| AUTH-01 | Valid login | Role-appropriate dashboard; rotated session; audit event |
| AUTH-02 | Invalid login | Generic error; failure counted; no account disclosure |
| AUTH-03 | Repeated failures | Distributed limit/delay/lockout activates |
| AUTH-04 | Inactive user | Access denied; event logged |
| AUTH-05 | CSRF missing | State-changing browser request rejected |
| USER-01 | Admin assigns role | Only assigned capabilities are granted |
| USER-02 | Privilege change | Existing session security state is refreshed or revoked |
| PROD-01 | Add product | Unique SKU; searchable |
| PROD-02 | Duplicate SKU/barcode | Unique constraint and safe validation response |
| PROD-03 | Archive referenced product | History retained; unavailable for new lines |
| PO-01 | Create and approve PO | Valid transitions and Decimal128 totals |
| PO-02 | Unauthorized approval | `403`; no state change |
| REC-01 | Full receipt | Positive ledger, balances, PO quantity, and audit committed atomically |
| REC-02 | Partial receipt | PO becomes partially received; outstanding quantity correct |
| REC-03 | Missing expiry | Validation fails; no ledger entry |
| REC-04 | Duplicate retry | One posting and same replay result |
| REC-05 | Transaction failure | Receipt, ledger, balance, PO, audit all roll back |
| REQ-01 | Submit request | Submitted state and audit |
| REQ-02 | Partial approval | Approved quantity cannot exceed requested |
| ISS-01 | Issue available stock | FEFO/FIFO correct; negative ledger; balance correct |
| ISS-02 | Insufficient stock | Rejected; no partial data |
| ISS-03 | Concurrent issues | At most available stock is committed |
| ISS-04 | Expired/quarantine lot | Allocation excludes lot |
| ADJ-01 | Approved adjustment | Ledger and balance change with reason and audit |
| ADJ-02 | Unapproved adjustment | Posting denied |
| REV-01 | Reverse posting | Opposite ledger; original retained and linked |
| ALERT-01 | Threshold reached | One open low-stock alert |
| ALERT-02 | Warning window | Expiry alert appears |
| REPORT-01 | Inventory report | Matches balance projection and filters |
| REPORT-02 | Movement report | Matches immutable ledger |
| REPORT-03 | Export | Queued, access-controlled, expiring download |
| AUDIT-01 | Sensitive action | Actor, time, action, reference, reason, safe changes recorded |
| BACKUP-01 | Backup | Success and checksum recorded |
| BACKUP-02 | Restore drill | Restored system passes integrity checks |

## 15.5 Mandatory invariant tests

1. Sum of signed ledger transactions equals on-hand balance for every key.
2. Failure at any posting step rolls back document, ledger, balance, reservation, audit, and idempotency success state.
3. Posted documents cannot be edited through UI, API, model/repository, or application service.
4. Reversal preserves the original and nets correctly.
5. Negative available stock is blocked by default.
6. Decimal calculations preserve required precision.
7. Every state transition is valid and authorized.
8. Same idempotency key creates only one stock movement.
9. Reusing a key with a different payload is rejected.
10. Out-of-organization access is denied and does not disclose existence.

## 15.6 Security tests

- authorization matrix for every endpoint;
- IDOR and cross-organization attempts;
- Mongo operator injection and unsafe query attempts;
- XSS and unsafe HTML;
- CSRF, CORS, cookie, and session fixation checks;
- rate limiting and lockout;
- reset-token expiry and reuse;
- upload type/signature/size attacks;
- log and secret leakage;
- dependency, source, and container scans.

## 15.7 Performance tests

Representative dataset:

- 10,000 products;
- 500 suppliers;
- 1,000,000 stock transactions;
- realistic balances and lots;
- 100 concurrent read users;
- agreed concurrent posting users.

Measure login, dashboard, product search, balance list, posting, movement report, export, reconciliation, queue latency, and database transaction conflicts. Review explain plans and indexes; do not hide poor queries behind excessive caching.

# 16. Deployment and operations

## 16.1 Environments

### Local

Docker Compose with:

- React/Express development services;
- MongoDB replica set;
- Redis;
- object-storage emulator.

Outbound email (invite links, password-reset links) is sent through real SMTP via nodemailer, configured with `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE`/`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_FROM`. No local mail-catcher container is used. When `MAIL_HOST` is unset, or whenever a developer does not want to wait on real email delivery while testing, the API's create-user and forgot-password responses include the raw invite/reset token directly in the JSON body outside production (`inviteToken` on `POST /users`, `devResetToken` on `POST /auth/forgot-password`) so the corresponding `/reset-password?token=...` page can be opened directly.

### Shared development

Automatic deployment from the development branch with non-production credentials and sanitized test data.

### Staging

Production-like topology for integration, performance smoke tests, migration rehearsals, UAT, security tests, and restore drills.

### Production

Restricted access, managed secrets, encrypted managed MongoDB, managed Redis, private object storage, centralized observability, monitored backups, and approved deployments.

## 16.2 CI pipeline

Every pull request:

1. Install locked dependencies.
2. Verify formatting.
3. Run lint and TypeScript checks.
4. Run unit and API tests.
5. Start a clean MongoDB replica set and Redis service.
6. Run migrations/index setup and seed smoke tests.
7. Run authorization tests.
8. Run dependency and secret scans.
9. Build web, API, worker, and container artifacts.
10. Produce coverage and test reports.

Release:

1. Tag and sign release where supported.
2. Deploy to staging.
3. Run migration, smoke, and critical E2E tests.
4. Require production approval.
5. Confirm backup/PITR state before risky database changes.
6. Deploy rolling or blue/green.
7. Run post-deploy health and business smoke tests.
8. Monitor errors, latency, transaction conflicts, queues, sessions, and database health.

## 16.3 MongoDB migrations

MongoDB still requires controlled migrations.

- Use versioned migration scripts for indexes, validators, backfills, field renames, and data transformations.
- Prefer expand/migrate/contract changes.
- Backfill in bounded batches with checkpoints and metrics.
- Create indexes safely and verify build impact.
- Do not remove old fields until all running versions no longer require them.
- Rehearse against production-sized sanitized data.
- Maintain a rollback or forward-fix plan.

## 16.4 Backup and disaster recovery

Minimum:

- automated daily full backup or managed snapshots;
- point-in-time recovery according to agreed RPO;
- encryption in a separate protection boundary;
- daily/weekly/monthly retention as required;
- automated success/failure monitoring;
- checksum/provider verification;
- regular restore to an isolated environment;
- post-restore ledger/balance integrity checks;
- documented recovery runbook and owners.

RPO and RTO are business decisions and must be approved. Example planning targets may be one-hour RPO and four-hour RTO, but they are not assumed requirements.

## 16.5 Observability

Structured logs include timestamp, severity, environment, version, correlation ID, user ID when known, route/action, document reference, safe error code, and duration.

Metrics include:

- request rate, latency, and errors;
- login failures, lockouts, and rate-limit events;
- MongoDB operation latency and transaction retries/conflicts;
- Redis availability and memory;
- queue depth, age, retries, and dead letters;
- stock posting duration and failures;
- reconciliation mismatches;
- export failures;
- backup success and restore-drill status.

Alerts cover sustained error rate, unavailable dependencies, queue backlog, critical security events, reconciliation mismatches, and backup failure.

## 16.6 Health endpoints

- Liveness: process event loop responds.
- Readiness: critical dependencies and configuration are available.
- Health responses expose no credentials, topology details, stack traces, or sensitive version data to unauthorized callers.

# 17. Development standards

- TypeScript strict mode and no unjustified `any`.
- Use explicit DTOs; do not pass Express request bodies directly to repositories.
- No cross-module model imports.
- No controller business logic.
- No floating-point quantity or money arithmetic.
- No hard-coded role checks.
- No direct stock-balance mutation outside inventory application services.
- No update/delete operation for posted ledger documents.
- No external network call inside MongoDB transactions.
- No secret or token in logs, tests, fixtures, screenshots, or frontend configuration.
- Every feature includes validation, authorization, audit, errors, tests, and documentation.

# 18. Implementation roadmap

## Phase 0 - Foundation

- Monorepo, TypeScript configs, lint/format/test tooling.
- Docker Compose MongoDB replica set, Redis, mail, and object storage.
- API error envelope, correlation ID, logging, health, config validation.
- CI pipeline and security scans.

Exit: clean install/build/test; replica-set transaction smoke test passes.

## Phase 1 - Identity and Access

- Users, roles, permissions, sessions, password reset, MFA framework.
- Redis session store, CSRF, CORS, security headers, rate limits, audit.
- Admin user and permission seed.

Exit: authentication and authorization acceptance tests pass.

## Phase 2 - Organization and Catalog

- Organization, departments, warehouses, locations, categories, units, products, barcodes.
- Archive behavior, search, indexes, responsive administration UI.

Exit: duplicate and archive tests pass; scoped access works.

## Phase 3 - Suppliers and Procurement

- Suppliers, purchase orders, line calculations, status workflow, approvals.

Exit: PO creation, submission, approval, rejection, and authorization tests pass.

## Phase 4 - Receiving vertical slice

- Goods receipts, lots, positive ledger, balances, idempotency, reversal, audit.
- First complete transaction and concurrency tests.

Exit: receipt acceptance matrix and rollback tests pass.

## Phase 5 - Requests and Issues

- Requests, approvals, reservations, FEFO/FIFO picking, issue posting, returns, reversal.

Exit: concurrent issue and insufficient-stock tests pass.

## Phase 6 - Transfers, Adjustments, and Counts

- Transfer workflows, adjustment thresholds, evidence, cycle/full counts, variance posting.

Exit: approval and reconciliation tests pass.

## Phase 7 - Alerts, Reports, and Exports

- Low-stock/expiry alerts, dashboards, reports, queued CSV/PDF exports.

Exit: report-to-source reconciliation and export authorization pass.

## Phase 8 - Operations and Hardening

- Backup run tracking, restore drill, observability, load tests, security review, UAT, runbooks.

Exit: all release gates pass and business owners approve production release.

# 19. Release gates

- All critical and high-severity tests pass.
- No unresolved critical security finding.
- Authorization matrix is complete.
- Clean deployment and migration from previous release snapshot pass.
- Stock posting rollback, idempotency, and concurrency tests pass.
- Ledger/balance reconciliation passes.
- Backup and restore procedures are demonstrated.
- Monitoring and alerts are active.
- UAT is signed off by designated business owners.
- Rollback/forward-fix plan is approved.

# 20. Open decisions

The build must not silently assume these business choices:

1. Single organization or multi-organization from first release.
2. Number and hierarchy of warehouses and locations.
3. Reservation timing: approval or picking.
4. Whether direct receipt/issue is permitted and for which roles.
5. Over-receipt tolerance and exception approval.
6. Whether creator self-approval is prohibited globally or by threshold.
7. Adjustment approval thresholds by quantity and value.
8. Valuation method and whether value reports are required.
9. Tax and discount requirements.
10. Currency and timezone.
11. Expiry warning windows and expired-stock disposition.
12. Notification channels and recipients.
13. Export retention and sensitive-report policy.
14. RPO, RTO, retention, and legal/audit retention periods.
15. MFA requirements and re-authentication rules.
16. Expected product, transaction, user, and concurrency volumes.
17. External integrations and API-client requirements.

Until decided, configurable safe defaults are used and documented; no unsafe shortcut may be introduced.

# 21. Forbidden shortcuts

- PHP, Laravel, MySQL, or SQL-specific implementation in this project.
- A mutable `products.quantityInStock` source of truth.
- JavaScript `number`, `parseFloat`, or `Number` for quantities or money.
- Running stock workflows on standalone MongoDB without transaction support.
- Long-lived JWTs or refresh tokens in browser storage.
- Hard-coded roles in controllers.
- Trusting frontend-hidden controls for authorization.
- Editing or deleting posted ledger transactions.
- Posting stock without an idempotency key.
- External calls inside database transactions.
- Catching an error and returning success.
- Disabling CSRF, CORS checks, rate limits, authorization, validation, or audit to make tests pass.
- Logging secrets, cookies, tokens, passwords, or sensitive payloads.
- Hard deleting referenced master records.
- Shipping without backup monitoring and a tested restore procedure.

# 22. Definition of done for every milestone

A milestone is complete only when it includes:

1. Domain rules and status transitions.
2. Database migrations, indexes, and validators.
3. Application service and transaction boundary.
4. Request/response schemas.
5. Authentication, permission, scope, and separation-of-duty enforcement.
6. Audit events and safe structured logging.
7. Error handling and idempotency where applicable.
8. Unit, API/integration, denial, rollback, and concurrency tests as applicable.
9. Frontend screens with accessibility and error states.
10. Updated documentation and implementation checklist.
11. Passing format, lint, type-check, test, build, migration, and security checks.

# Appendix A - Example environment variables

```text
NODE_ENV=development
APP_NAME=Inventory Management System
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:4000
PORT=4000
TRUST_PROXY=1

MONGODB_URI=mongodb://mongo1:27017,mongo2:27018,mongo3:27019/ims?replicaSet=rs0
MONGODB_DB_NAME=ims
REDIS_URL=redis://redis:6379

SESSION_COOKIE_NAME=ims.sid
SESSION_SECRET=<secret-manager-value>
SESSION_IDLE_MINUTES=30
SESSION_ABSOLUTE_HOURS=12
CSRF_SECRET=<secret-manager-value>

PASSWORD_PEPPER=<secret-manager-value>
MFA_ENCRYPTION_KEY=<secret-manager-value>

OBJECT_STORAGE_ENDPOINT=http://minio:9000
OBJECT_STORAGE_BUCKET=ims-private
OBJECT_STORAGE_ACCESS_KEY=<local-only>
OBJECT_STORAGE_SECRET_KEY=<local-only>

MAIL_HOST=<smtp-host>
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<secret-manager-value>
MAIL_PASSWORD=<secret-manager-value>
MAIL_FROM=inventory@example.test

LOG_LEVEL=debug
CORS_ALLOWED_ORIGINS=http://localhost:5173
DEFAULT_TIMEZONE=UTC
DEFAULT_CURRENCY=USD
DEFAULT_EXPIRY_WARNING_DAYS=90
```

Production values must come from a secrets manager. `.env` is never committed.

# Appendix B - Key architectural decisions

- ADR-001: MERN modular monolith.
- ADR-002: MongoDB immutable ledger and balance projection.
- ADR-003: Replica-set transactions and conditional balance updates.
- ADR-004: Decimal128 storage and decimal-string API.
- ADR-005: Redis-backed browser sessions and CSRF protection.
- ADR-006: Granular RBAC and record-scope policy.
- ADR-007: Lot/expiry and FEFO/FIFO allocation.
- ADR-008: Idempotent stock posting.
- ADR-009: Queued exports and notifications.
- ADR-010: Backup, restore, and disaster-recovery targets.
