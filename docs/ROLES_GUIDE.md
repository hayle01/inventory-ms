# Roles guide

The system seeds five system roles at bootstrap (`apps/api/src/modules/access/domain/permissionCatalog.ts`, `SYSTEM_ROLE_PERMISSIONS`). Role **names** are seed labels only — every authorization check in the codebase tests a granular permission string (e.g. `stock_requests.approve`), never a role name, and roles are just named bundles of permissions that an organization can freely re-customize after seeding (add/remove permissions, add new roles, rename these). Assign roles to users on the **Users** page; view/edit the permission bundle for each role on the **Roles** page; browse the full permission catalog with descriptions and risk levels on the **Permissions** page.

A user's effective permissions are the union of every permission on every role assigned to them, further narrowed by their `departmentId`/`warehouseScopeIds` for scoped resources.

---

## Administrator

**Every permission in the system**, including the ones no other seeded role has: `users.*`, `roles.manage`, `organizations.manage`, `settings.manage`, `audit.view`. This is the only role that can manage other users, roles, and organization-wide configuration.

**Typical use**: IT/ops admin, system owner. Not meant for day-to-day warehouse work — it's a superset of every other role below.

**Example**: Only an Administrator can invite a new user (`POST /users`), assign them the "Store Manager" role, or view the audit log for a disputed stock adjustment.

---

## Store Manager

Runs procurement and approves the workflows other roles submit. Can create/update/archive products and suppliers, and **approve** (not just submit) purchase orders, stock requests, transfers, adjustments, and counts, plus post receipts and issues directly.

Full bundle: `products.view/create/update/archive`, `categories.view/manage`, `units.manage`, `suppliers.view/manage`, `purchase_orders.view/create/update/submit/approve/reject/cancel`, `receipts.view/verify/post`, `stock_requests.view/approve/reject`, `issues.view/post`, `transfers.view/approve`, `adjustments.view/approve/reject/post/reverse`, `stock_counts.view/approve/reject/post/reverse`, `inventory.view`, `alerts.view/acknowledge/resolve`, `reports.view/export`, `warehouses.view`, `departments.view`.

**Cannot**: manage users/roles, manage warehouses/locations (view only), reverse a receipt or issue, or edit organization settings.

**Example**: An Inventory Clerk submits a Stock Request for 50 units of a SKU. A Store Manager reviews it on the **Approvals** inbox and approves it (`stock_requests.approve`), which reserves the stock. The Store Manager can also directly post a purchase-order receipt when goods arrive (`receipts.post`), or approve a stock count variance (`stock_counts.approve` → `stock_counts.post`).

---

## Inventory Clerk

The day-to-day warehouse operator. Creates and posts the documents that actually move stock — receiving, issuing, returning — but cannot approve requests, purchase orders, adjustments, or transfers (those need a Store Manager). Notably has **no purchase-order permissions at all**.

Full bundle: `products.view`, `suppliers.view`, `receipts.view/create/update/verify`, `stock_requests.view`, `issues.view/create/pick/post`, `returns.view/create/post`, `transfers.view/create/submit`, `adjustments.view/create/submit`, `stock_counts.view/create/submit`, `inventory.view`, `alerts.view`, `warehouses.view`.

**Cannot**: post a receipt (`receipts.post` is Store-Manager-only), approve/reject anything, view or create purchase orders, view reports.

**Example**: A delivery arrives — the clerk creates a goods receipt and verifies the line items (`receipts.create`, `receipts.verify`), but a Store Manager has to post it before stock lands in `stockBalances`. When a Stock Request is approved, the clerk picks and posts the Stock Issue against it (`issues.pick`, `issues.post`) — issuing itself doesn't require a separate approval step.

---

## Requester

The narrowest role — for staff who need stock but don't handle it. Can only create and manage their own Stock Requests.

Full bundle: `products.view`, `inventory.view`, `stock_requests.view/create/update/submit/cancel`.

**Cannot**: approve their own request (self-approval is explicitly blocked at the service layer regardless of permissions — separation of duty), see purchase orders, receipts, issues, or reports.

**Example**: A department staff member creates a Stock Request for office supplies, submits it, and can cancel it while it's still pending — but has no visibility into whether/when it's fulfilled beyond the request's own status.

---

## Auditor

Read-only across almost everything, including the one view permission no operational role has: `audit.view`.

Full bundle: `products.view`, `suppliers.view`, `purchase_orders.view`, `receipts.view`, `stock_requests.view`, `issues.view`, `returns.view`, `transfers.view`, `adjustments.view`, `stock_counts.view`, `inventory.view`, `alerts.view`, `reports.view`, `audit.view`, `operations.view`.

**Cannot**: create, submit, approve, post, or reverse anything. Cannot manage users or roles either — this role is deliberately incapable of changing system state.

**Example**: A compliance reviewer opens the **Audit** report to trace who posted a specific stock adjustment and why (the `reason` captured at posting time), without being able to alter any record.

---

## Quick comparison

| Action | Administrator | Store Manager | Inventory Clerk | Requester | Auditor |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage users/roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/approve purchase orders | ✅ | ✅ | ❌ | ❌ | view only |
| Post a receipt | ✅ | ✅ | ❌ (verify only) | ❌ | view only |
| Create/submit a stock request | ✅ | ❌ | ❌ | ✅ | view only |
| Approve a stock request | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pick/post a stock issue | ✅ | post only | ✅ | ❌ | view only |
| Approve/post an adjustment | ✅ | ✅ | submit only | ❌ | view only |
| View audit log | ✅ | ❌ | ❌ | ❌ | ✅ |
| View reports | ✅ | ✅ | ❌ | ❌ | ✅ |

If your organization needs a role that doesn't fit this table (e.g. a warehouse-scoped approver, or a procurement-only role without stock-posting rights), create a new role on the **Roles** page and hand-pick permissions from the **Permissions** catalog rather than editing these seeded roles' fixed responsibilities. This is what these five roles are meant to be: a conservative starting point, not the final word.
