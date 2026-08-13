# Manual Testing Guide

A beginner-friendly, click-through guide to testing the whole system in the browser — module by module, in the order the data actually depends on it. Every section tells you: where to click, what each field means, what's required vs optional, what happens when you break a rule on purpose, and what every field in the result means. No prior knowledge of the codebase assumed.

If you want the same coverage from `curl`/Postman instead of the browser, see [`TESTING_GUIDE.md`](./TESTING_GUIDE.md). For what each role can and can't do, see [`ROLES_GUIDE.md`](./ROLES_GUIDE.md). For Docker service access (Mongo, Redis, MinIO, SMTP), see [`LOCAL_SERVICES.md`](./LOCAL_SERVICES.md).

---

## Part 1 — Before you start

### 1.1 Core ideas you need before anything else makes sense

- **Everything belongs to one organization.** Every record has an invisible `organizationId` and every query is scoped to it automatically. You won't see this field in the UI; it's mentioned here so "why can't I see the other org's data" never comes up — there is only one org per deployment today (see the multi-tenant note in `SYSTEM_DOCUMENTATION.md`).
- **The ledger is the source of truth, balances are a projection.** Every action that moves stock (receiving, issuing, returning, adjusting, transferring) writes one or more rows to an internal, append-only **stock ledger**. You never edit or delete a ledger row. The "on hand" numbers you see everywhere are a **projection** computed from that ledger — if a number ever looks wrong, the fix is always a new correcting ledger entry (a reversal, return, or adjustment), never editing the old one.
- **Quantities and money are always shown and typed as text**, e.g. `"12.5"`, never a plain number field that rounds. This is intentional — it's how the system guarantees no floating-point rounding errors on stock or money. Typing `12.5abc` should always be rejected.
- **Documents move through a fixed lifecycle (a "status machine").** A Purchase Order can't jump from `draft` straight to `posted` — it must pass through every allowed step, and the button for an action only appears when the document is in a status that allows it and you hold the right permission. If you don't see a button you expected, check the status badge and your role first.
- **Posted/completed documents are read-only forever.** Once something posts stock (a receipt, issue, adjustment, transfer, count), you cannot edit or delete it — corrections happen through a **reversal**, which creates a brand-new linked document that nets the original back out. Both the original and the reversal stay visible.
- **Two people are required for every approval workflow.** The person who *created* a document (Purchase Order, Stock Request, Adjustment, Transfer, Stock Count) can never *approve* their own — the system blocks this even for an Administrator account, by design (separation of duty). You need at least two test accounts to test any approval flow. See 1.2.
- **Stock posting actions require an idempotency key.** You won't see this directly (the browser sets it for you), but if you ever replay the exact same network request twice, the system guarantees it only moves stock once — this is what stops a flaky network from double-charging inventory.
- **Every sensitive action is audited.** Every posting, approval, rejection, reversal, login, and permission change is written to an append-only audit log with who/when/what/why. You can read it at **Reports & Insights → Audit Trail** if you hold `audit.view`.

### 1.2 Accounts you need before testing approvals

Self-approval is blocked everywhere: Purchase Orders, Stock Requests, Adjustments, Transfers, and Stock Counts. You need **at least two accounts** to test any approve/reject flow.

1. Log in as the seeded admin (`admin` / the password the seed script printed, or set via `SEED_ADMIN_PASSWORD`). Use this account only for initial setup (catalog, suppliers, warehouses, users) — don't use it to test approvals, since testing "can I approve my own thing" needs a *different* creator and approver.
2. Go to **Users & Access → Users → New user** and create two more:
   - **`clerk1`** — assign the seeded **Inventory Clerk** role. Creates/picks/posts receipts, issues, returns; submits requests, adjustments, counts, transfers.
   - **`manager1`** — assign the seeded **Store Manager** role. Approves/rejects/posts most workflows.
3. After creating each user, the app shows a **one-time invite link** in a dialog (`Copy link` button) — this is how the new user sets their first password (no email needed in dev; see 1.5). Open that link in a private/incognito window to set the password and log in as that user.
4. Keep two browser windows open (e.g. one normal, one incognito) so you can act as creator in one and approver in the other without repeatedly logging in/out.

See [`ROLES_GUIDE.md`](./ROLES_GUIDE.md) for exactly what each of the 5 seeded roles (Administrator, Store Manager, Inventory Clerk, Requester, Auditor) can and can't do, with a comparison table.

### 1.3 Reading the UI

- **Status badges** use consistent colors everywhere: outline/gray = draft/not started, amber = in progress/awaiting a decision, green = completed/posted, red = rejected/cancelled.
- **Navigation**: the launcher (`/apps`, click the logo icon top-left) is a grid of module-group tiles. Opening a tile shows its sibling pages as **tabs in the top bar** — you don't need to go back to the grid to switch between related pages (e.g. inside "Requests & Issues" you'll see Stock Requests / Stock Issues / Stock Returns tabs). Hover the top-left icon and it turns into a back arrow.
- **Approvals bell** (top-right): shows a count of every document across every module that's waiting on a permission you hold. This is the fastest way to find your pending work without hunting through each module.
- **Your avatar → Profile**: your own account info, change-password form, and active-session management (revoke a session, or sign out everywhere).

### 1.4 Testing order — why it matters

Later modules depend on data that only exists once you've created it in an earlier module. Test in roughly this order:

```
Users & Access  →  Organization (Departments, Warehouses, Locations)
      ↓
Catalog (Units, Categories, Products)  →  Suppliers
      ↓
Procurement (Purchase Orders)  →  Receiving (Goods Receipts)
      ↓
Requests & Issues (Stock Requests → Stock Issues → Stock Returns)
      ↓
Adjustments & Counts   +   Transfers
      ↓
Reports & Insights  (read-only — needs data from everything above)
      ↓
Approvals inbox  +  Audit Trail  (cross-cutting — visible throughout)
```

A **Storage Location** inside a warehouse is a separate record from the warehouse itself, and only `locations.manage` (Administrator only, in the seeded roles) can create one. Create at least one location per warehouse *before* trying to receive stock, issue stock, or transfer stock — every stock-moving line item needs a location, and the location picker will simply be empty (with a "no locations yet" hint) if you skip this.

### 1.5 Email in local/dev testing

Real SMTP sends invite and password-reset emails via `nodemailer`, sent from a separate **worker** process (`pnpm dev` starts api + web + worker together — if you're running them individually, make sure `pnpm dev:worker` is running too, or nothing will ever be sent). If `MAIL_HOST` isn't configured, the worker skips sending and logs a warning instead of failing — you're not blocked either way. In both cases, the API returns the raw dev-only value directly in its JSON response outside production:
- Creating a user → `inviteToken` in the response, and the Users UI shows it as a copyable `/reset-password?token=...` link in a dialog right after you create the user.
- `POST /auth/forgot-password` → `devResetCode` in the response; the app carries it forward automatically to the Verify Code page and displays it there in a "Dev mode" banner, so you never have to check a mailbox to test the reset flow.

---

## Part 2 — Access: Users, Roles, Permissions

*Module group: **Users & Access**. Dependency: none — this is the starting point.*

### 2.1 Users

**Navigate:** Users & Access → Users → **New user**.

| Field | Meaning | Try (valid) | Try (invalid) | Expected |
|---|---|---|---|---|
| Full name | Display name | `Jordan Rivera` | (empty) | "Full name is required." |
| Username | Login identifier, lowercase, 3–64 chars, letters/digits/`.`/`_`/`-` only | `jrivera` | `Jordan Rivera` (spaces/caps) or a username that already exists | Format error, or duplicate-username conflict |
| Email | Login identifier alternative + where invite/reset links notionally go | `jordan@example.test` | `not-an-email` | Email format error |
| Department | Optional; scopes the user for department-based reporting | pick one (create one first in Organization if empty) | — | — |
| Warehouse scope | Optional; which warehouses this user's work is restricted to | pick one or more | — | Leaving this empty means no warehouse restriction beyond permissions |
| Roles | Which permission bundles this user gets | pick one or more seeded roles | leave unassigned | Should still save — a user with zero roles has zero permissions and sees an empty launcher on login |

**On create**, the response includes an `inviteToken` (dev-only) that the UI turns into a copyable one-time set-password link — this is how the new user gets into the system without a real mailbox.

**Response fields on the Users list/detail**: `status` (`invited` → `active` after they set a password, or `locked`/`inactive`/`archived`), `roleNames` (resolved role names — shown as a column on the list and on your own Profile page; empty means zero roles assigned), `mfaEnabled` (whether TOTP MFA is turned on — **note: there is currently no in-app UI to enroll MFA**, so this will always read `false` in this build), `lastLoginAt`, `directPermissionNames` (permissions granted straight to this user outside any role — rare, usually empty).

**Things to break on purpose:**
- **Duplicate username** — create two users with the same username. Expect a conflict, not a 500 error.
- **Deactivate a user**, then try to log in as them in a private window. Expect the exact same generic "invalid username/email or password" message as a wrong password — the system must never reveal *why* a login failed.
- **Repeated failed logins** (10+) for one account. Expect eventual lockout — same generic error, but now failing even with the *correct* password. This proves account lockout, not just rate limiting.
- **Forgot password** with a real email and a fake one. Both must show the identical generic message and both take you to the same Verify Code page — see Part 13.3 for the full walkthrough.

### 2.2 Roles

**Navigate:** Users & Access → Roles → **New role**.

| Field | Meaning | Notes |
|---|---|---|
| Name | Role label | 2–100 chars |
| Description | Free text | optional, ≤500 chars |
| Permissions | Checklist from the full permission catalog | must pick at least 1 |

**Test:**
- Create a role with only `products.view` checked. Assign it to a throwaway user. Log in as them: only the Catalog tile should be reachable, and read-only (no "New product" button, no edit/archive).
- Try to rename/delete a seeded system role (Administrator, Store Manager, Inventory Clerk, Requester, Auditor). These are marked `isSystem: true` and protected from deletion; editing their permission set may still be allowed — try it and see which the UI blocks.

### 2.3 Permissions

**Navigate:** Users & Access → Permissions.

Read-only catalog of every permission string in the system, grouped by module, with a **risk level** (low/medium/high — e.g. `.approve`/`.post`/`.reverse`/`.manage` actions are high-risk) and a plain-English description. Use this page to look up what a permission actually does before assigning it to a role. Search box filters by name or description.

---

## Part 3 — Organization: company profile, departments, warehouses, locations

*Module group: **Organization**. Dependency: Users (for department managers).*

### 3.1 Organization profile

**Navigate:** Organization → Organization.

Fields: `name`, `timezone`, `currencyCode` (3-letter ISO code, e.g. `USD`). This is a single record — there's no create/delete, only edit, and only with `organizations.manage` (Administrator only in the seeded roles).

### 3.2 Departments

**Navigate:** Organization → Departments → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Code | Short internal identifier | 1–32 chars, letters/digits/`_`/`-` |
| Name | Display name | 1–200 chars |
| Manager | Optional link to a User | must be an existing user id |

Departments group requesters for reporting; they're referenced by Users (§2.1) and can be archived (not hard-deleted — archived records stay referenced by history but drop out of pickers).

### 3.3 Warehouses

**Navigate:** Organization → Warehouses → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Code | Short identifier | 1–32 chars |
| Name | Display name | 1–200 chars |
| Address | Optional | ≤500 chars |
| Is default | Marks the default warehouse used as a fallback | boolean |

### 3.4 Storage locations (inside a warehouse)

**Navigate:** Organization → Warehouses → open a warehouse → **Manage locations**.

This is the piece almost everyone misses first: a warehouse and its locations are *separate* records. **You cannot receive, issue, adjust, or transfer stock into a warehouse with zero locations** — the location picker on those forms will be empty. Create at least one per warehouse now, before moving on to Procurement/Receiving.

| Field | Meaning | Validation |
|---|---|---|
| Code | Short identifier, unique within the warehouse | 1–32 chars |
| Name | Display name, e.g. "Main floor", "Cold storage" | 1–200 chars |
| Type | `normal`, `quarantine`, `damaged`, `expired`, `in_transit` | Only Administrators (in the seeded roles) hold `locations.manage`; everyone else sees this page read-only |

The location `type` matters later: a **damaged** goods-receipt line or a **damaged/quarantine** stock return should land in a location whose type matches (the UI doesn't force this today, but reviewing your data model this way is the intent — worth testing whether a damaged receipt line can be pointed at a `normal` location, and noting that as an open gap if so).

---

## Part 4 — Catalog: units, categories, products

*Module group: **Catalog**. Dependency: none for Units/Categories; Products need both.*

### 4.1 Units of measure

**Navigate:** Catalog → Units → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Code | Short identifier | 1–32 chars |
| Name | e.g. "Each", "Box of 12" | 1–100 chars |
| Symbol | e.g. "ea", "bx" | 1–16 chars |
| Decimal places | How many decimal digits this unit allows when entering quantities | integer 0–6 (0 = whole numbers only, e.g. you can't receive "2.5 boxes") |

### 4.2 Categories

**Navigate:** Catalog → Categories → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Code | Short identifier | 1–32 chars |
| Name | Display name | 1–200 chars |
| Parent category | Optional, for nested categories | must reference an existing category |
| Description | Optional | ≤1000 chars |

### 4.3 Products

**Navigate:** Catalog → Products → **New**. Requires at least one Category and one Unit to already exist.

| Field | Meaning | Validation |
|---|---|---|
| SKU | Unique product code | 1–32 chars, letters/digits/`_`/`-`, auto-uppercased |
| Name | Display name | 1–300 chars |
| Category / Unit | Links | must reference existing records |
| Product type | `consumable` \| `medicine` \| `equipment` \| `other` | — |
| Purchase price | What you pay a supplier, decimal string | ≥ 0 |
| Issue price | What you charge/value on issue, decimal string, optional | ≥ 0 if set |
| Reorder level | Triggers the Low Stock report when available quantity falls at/below this | decimal string, ≥ 0 |
| Reorder quantity | Suggested reorder amount, optional | ≥ 0 if set |
| Track lots | Whether receipts of this product must record a lot number | boolean |
| Track expiry | Whether receipts must record an expiry date | boolean — **requires Track lots to also be on**; toggling this on alone without lots is rejected |
| Expiry warning days | How many days before expiry the Expiry report flags this product as "warning" | integer ≥ 0, default 90 |
| Allow negative stock | Per-product override of the system-wide "block negative available stock" rule | boolean, default off |
| Barcodes | Up to 10 barcode strings | each 1–64 chars |

**Test:**
- Toggle **Track expiry** on without **Track lots**. Expect a validation error tying the two together.
- Create a product, then try creating a second with the **same SKU**. Expect a uniqueness conflict.
- Archive a product, then try referencing it on a new Purchase Order line. Expect it to be unselectable/rejected — archived master data is never hard-deleted but must drop out of new transactions.

---

## Part 5 — Suppliers

*Module group: **Suppliers**. Dependency: none.*

**Navigate:** Suppliers → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Code | Short identifier | 1–32 chars |
| Name | Display name | 1–200 chars |
| Address / Phone / Email / Tax identifier / Notes | Optional contact info | Email must be a valid format if provided |

Open a supplier to manage its **contacts** (name, job title, phone, email, one marked primary) — separate sub-records, same idea as warehouse locations.

---

## Part 6 — Procurement: Purchase Orders

*Module group: **Procurement**. Dependency: Suppliers, Warehouses, Products.*

### 6.1 Lifecycle

```
draft → submitted → approved → partially_received → fully_received → closed
  ↓         ↓                        ↑ (reached only by posting Goods Receipts against it)
cancelled  rejected/cancelled
```

- `draft`/`submitted` can be cancelled directly (`purchase_orders.cancel`).
- `submitted` can be rejected (`purchase_orders.reject`, needs a reason) or approved (`purchase_orders.approve`).
- `approved` can be cancelled, or moves to `partially_received`/`fully_received` automatically — **only by posting a Goods Receipt against it** in the Receiving module (§7). You cannot set these two statuses directly.
- `fully_received` can be **closed** (`purchase_orders.close`) — a manual, terminal step confirming the order is done and nothing further will be received against it.
- `rejected`, `closed`, `cancelled` are all terminal — no further action.

### 6.2 Create a purchase order

**Navigate:** Procurement → Purchase Orders → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Supplier | Who you're ordering from | must be active |
| Warehouse | Where it'll be received | must be active |
| Order date / Expected date | Optional dates | — |
| Currency code | 3-letter ISO code | default `USD` |
| Line items | Product, ordered quantity, unit cost, tax amount, discount amount | quantity must be > 0; costs/tax/discount ≥ 0; 1–200 lines |
| Notes | Free text | ≤2000 chars |

**Response/detail fields**: `subtotal`, `taxTotal`, `discountTotal`, `total` are all computed server-side from the lines — never trust client-side math here; per-line `orderedQuantity` vs `receivedQuantity` (starts at 0, only Receiving updates it) vs `lineTotal`.

### 6.3 Workflow actions to test

1. **Submit** (draft → submitted). No body needed.
2. **Approve** as a *different* user than the creator. Then try approving a different order **as its own creator** — expect `403` "You cannot approve a purchase order you created." shown as an inline alert inside the confirm dialog (every `ConfirmDialog` in the app surfaces mutation errors this way now, not just a silent flash).
3. **Reject** with a reason (required, 1–1000 chars). Try submitting an empty reason — expect a client-side block before the request even fires.
4. **Cancel** with a reason, from `draft`, `submitted`, or `approved`. Confirm a `fully_received`/`closed`/`rejected` order has no Cancel button.
5. **Receive** (button appears once `approved` or `partially_received`) — jumps to Receiving (§7) prefilled from this PO.
6. Once fully received, **Close** it. Confirm the "Goods receipts" badge row on this page links to every receipt posted against it (added specifically so you can trace PO → receipt without hunting through the Receiving list).

---

## Part 7 — Receiving: Goods Receipts

*Module group: **Receiving**. Dependency: Suppliers, Warehouses + Locations, Products, optionally a Purchase Order.*

### 7.1 Lifecycle

```
draft → verified → posted → (reversed, stamped on the original)
```

Posting a receipt is the **first point stock actually enters the ledger** — draft/verified receipts don't move stock yet.

### 7.2 Create a receipt

**Navigate:** Receiving → Goods Receipts → **New**, or click **Receive** from an approved/partially-received Purchase Order (prefills supplier, warehouse, and one line per outstanding PO quantity).

| Field | Meaning | Validation |
|---|---|---|
| Purchase order | Optional link — leave as "Direct receipt (no PO)" for stock with no PO | if set, must be `approved`/`partially_received` |
| Supplier / Warehouse | Required | must be active |
| Supplier document number | Their packing-slip/invoice number | optional, ≤100 chars |
| **Per line:** Product | — | must exist, not archived |
| Destination location | Where this line lands | **must exist — create locations first (§3.4)** |
| Received quantity | Total physically received | ≥ 0 |
| Accepted quantity | How much passes inspection | ≥ 0, and **accepted + rejected must exactly equal received** |
| Unit cost | Cost per unit for this line | ≥ 0 |
| Condition | `good` \| `damaged` \| `quarantine` | — |
| Lot number | Required if the product has "Track lots" on **and** accepted quantity > 0 | ≤100 chars |
| Expiry date | Required if the product has "Track expiry" on **and** accepted quantity > 0 | — |
| Notes | Optional | ≤1000 chars |

**Test the math rule on purpose:** set received = 10, accepted = 7, rejected left at its default (0). Expect a validation error — rejected must be entered as 3, not left implicit.

**Test lot/expiry enforcement:** pick a product with Track lots + Track expiry on, leave Lot number blank with a nonzero accepted quantity. Expect `"<SKU> requires a lot number for accepted stock."`

**Auto-fill from a PO**: picking a Purchase Order from the dropdown *after* starting a fresh, untouched draft (no supplier chosen yet, still the single default blank line) auto-fills supplier/warehouse and one line per outstanding quantity — same as arriving via the PO's "Receive" button. Once you've started editing, selecting a PO only links it without overwriting your lines.

### 7.3 Workflow actions

1. **Verify** (draft → verified) — a review checkpoint, no stock movement yet.
2. **Post** (verified → posted) — this is where accepted quantities actually land in `stockBalances` at their destination locations, and a `receipt` ledger transaction is written per line. Requires `receipts.post` (Store Manager in the seeded roles — note the Inventory Clerk can create/verify but *not* post; this is deliberate separation of duty). Requires an Idempotency-Key (the browser supplies one automatically) — replaying the exact same post twice must produce exactly one stock movement, not two.
3. **Reverse** (posted → stamped `reversed`) — creates a linked reversal that nets the quantities back out. The original stays visible and unedited; open it and confirm you can navigate to the reversal and back.
4. If the receipt came from a PO, posting also updates that PO's `receivedQuantity` per line and flips its status to `partially_received` or `fully_received` automatically (§6.1) — go check the PO after posting to confirm this cross-module effect.

---

## Part 8 — Requests & Issues: the full request-to-fulfillment chain

*Module group: **Requests & Issues**. Dependency: Warehouses + Locations, Products, and (to have something to issue) posted stock from Receiving.*

This is the richest workflow in the system — three linked documents, in order: **Stock Request** (someone asks for stock) → **Stock Issue** (a clerk picks and posts it) → **Stock Return** (optional, if picked stock comes back).

### 8.1 Stock Requests — lifecycle

```
draft → submitted → approved → partially_fulfilled → fulfilled
              ↓          ↓            ↓
          rejected   cancelled    cancelled
```

`partially_fulfilled`/`fulfilled` are reached only by **posting Stock Issues** against this request — never set directly.

**Navigate:** Requests & Issues → Stock Requests → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Warehouse | Where the stock should come from | required |
| Needed by | Optional target date | — |
| Line items | Product, requested quantity, note | quantity > 0; 1–200 lines |
| Notes | Optional | ≤2000 chars |

**Approve** (`stock_requests.approve`) approves the *full* requested quantity on every line at once — the UI doesn't currently support line-by-line partial approval; the dialog explicitly says to reject and ask for a resubmission instead if only part should be approved. Approving **reserves** that quantity (increments `reservedQuantity` on the matching stock balance) without moving any stock yet — this is why approving a request for more than what's currently available should still succeed (reservation isn't a hard stock check the way posting an issue is); test this and note if it doesn't.

**Test self-approval**: log in as the requester, try approving your own submitted request. Expect `403` with `"You cannot approve a stock request you created."` — confirm the dialog now shows this message inline (this was a known bug: the dialog used to just flash and silently swallow the error; it's fixed to show an inline alert, verify it).

### 8.2 Stock Issues — lifecycle

```
draft → picked → posted → reversed
   ↓        ↓
cancelled cancelled
```

**Navigate:** click **Issue** from an `approved`/`partially_fulfilled` Stock Request (there's no standalone "New" — every issue must trace back to a request).

Creating an issue **auto-allocates** lines using FEFO for lot/expiry-tracked products (nearest expiry first, then received date, oldest first) or FIFO for everything else (received date only, oldest first) — pulling from whatever balances currently have available quantity across all locations in the request's warehouse. This is a pure, deterministic allocation function: same inputs always produce the same picked lots/locations, ties broken by balance id.

| Field (per line, editable while `draft`) | Meaning | Validation |
|---|---|---|
| Location | Which specific bin the pick came from | can be overridden by a clerk |
| Lot | Which batch, if lot-tracked | can be overridden |
| Picked quantity | How much to take from that location/lot | ≥ 0 |

**Post** (`issues.post`) is where stock actually leaves — a negative `issue` ledger transaction per line, and the linked Stock Request's `fulfilledQuantity` updates, moving it to `partially_fulfilled` or `fulfilled`. Requires Idempotency-Key.

**Test the negative-stock guard**: two browser tabs, same low-stock product, both post an issue for nearly all of the available quantity at the same time. Exactly one should succeed (`200`); the other must get a business-error conflict (`422`), never a negative available quantity and never two successful posts that together oversell.

**Reverse** (posted → reversed) nets the quantity back in and releases the link, same shape as receipts.

### 8.3 Stock Returns — lifecycle

```
draft → posted
```

No approval step — only `returns.view/create/post` exist. Simpler and terminal in two steps.

**Navigate:** from a **posted** Stock Issue → **Return**.

| Field (per line) | Meaning | Validation |
|---|---|---|
| Issue line | Which original picked line this return is against | must reference a line on the source issue |
| Quantity | How much is coming back | > 0, and **cannot exceed that line's outstanding picked-minus-already-returned quantity** |
| Condition | `good` \| `damaged` \| `quarantine` | routes the returned stock to a matching-type location/stock-state rather than blindly back to "available" |
| Reason | Optional | ≤500 chars |

**Test:**
- Return more than was picked on a line. Expect `422` rejecting the excess.
- Return with condition `damaged`. Confirm the stock lands in a non-`available` state (check the product's balance afterward — it should not appear as sellable/issuable available stock).
- **Post without an Idempotency-Key header** (only reachable via curl/Postman, not the browser UI — see `TESTING_GUIDE.md` if you want to hit this directly) — expect `400`.

---

## Part 9 — Adjustments & Counts

*Module group: **Adjustments & Counts**. Dependency: Warehouses + Locations, Products (ideally with some existing stock from Receiving, so a "decrease" adjustment has something to decrease).*

### 9.1 Stock Adjustments — lifecycle

```
draft → submitted → approved → posted → reversed
              ↓
          rejected
```

No cancel branch — once submitted, an adjustment must be approved-and-posted or rejected; there's no cancel button waiting in `draft` either the way other modules have (confirm this while testing — if you find one, that's worth flagging as a documentation/behavior mismatch).

**Navigate:** Adjustments & Counts → Stock Adjustments → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Warehouse | — | required |
| Reason code | `damage` \| `theft` \| `expiry` \| `count_correction` \| `system_error` \| `other` | required |
| Line items | Product, location, lot (optional), stock state, **quantity delta** | delta is signed — positive increases on-hand, negative decreases it; **cannot be zero** |
| Evidence note / Notes | Optional | ≤2000 chars each |

**`requiresElevatedApproval` — read this carefully**: if the *sum of the absolute value* of every line's delta on the adjustment reaches a configurable threshold (`ADJUSTMENT_MATERIAL_QUANTITY_THRESHOLD`, default **100**), the DTO returns `requiresElevatedApproval: true`. **This is informational only in the current build** — it flags the document for a reviewer's attention but does **not** actually gate approval behind a different/extra permission. Any user with plain `adjustments.approve` can still approve it. Test this explicitly: create an adjustment whose lines sum to ≥100 magnitude, confirm the flag shows `true` somewhere in the UI, then confirm a normal Store Manager can approve it anyway with no extra prompt — if the UI implies otherwise, that's a documentation/UX mismatch worth flagging, not a security bug (the permission model itself is unaffected).

**Post** (`adjustments.post`) writes a signed `adjustment` ledger transaction per line and updates the balance directly. **Reverse** creates a linked, sign-flipped adjustment.

**Test self-approval**, same pattern as §8.1: creator cannot approve their own submitted adjustment.

### 9.2 Stock Counts — lifecycle

```
draft → submitted → approved → posted → reversed
              ↓
          rejected
```

**Navigate:** Adjustments & Counts → Stock Counts → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Warehouse | — | required |
| Scope | `cycle` (a subset of products/locations) or `full` | required |
| Blind count | If on, the counter doesn't see the system's expected quantity while entering counts — reduces bias toward confirming the system number | boolean, default on |
| Items | Which product+location(+lot) combinations to count | 1–500 lines; the system snapshots each one's `systemQuantity` **at creation time** |

While `draft`, enter `countedQuantity` per line — the system computes `varianceQuantity` (`counted − system`) live. `varianceLineCount` on the DTO tells you how many lines don't match.

**Post** applies each line's variance as an implicit adjustment to bring on-hand in line with what was actually counted — same ledger mechanics as §9.1, just derived from variance instead of a typed delta.

**Test the blind-count claim**: as the counter, confirm you genuinely cannot see the system quantity while entering counts when Blind count is on, and that you *can* when it's off.

---

## Part 10 — Transfers

*Module group: **Transfers**. Dependency: two Warehouses (each with Locations) and existing available stock at the source location.*

### 10.1 Lifecycle

```
draft → submitted → approved → in_transit → completed → reversed
                          ↓
                     completed   (skips in_transit entirely under the "immediate" policy)
```

No reject/cancel branch — only `transfers.view/create/submit/approve/post/reverse` exist.

**Navigate:** Transfers → **New**.

| Field | Meaning | Validation |
|---|---|---|
| Source warehouse / Destination warehouse | — | must differ |
| In-transit policy | `immediate` (post takes stock straight from source to destination in one step) or `in_transit` (default — post moves it to an in-transit state first, then a separate receive step lands it at the destination) | — |
| Line items | Product, source location, destination location, lot (optional), quantity | **source and destination location must differ**; quantity > 0; 1–200 lines |

**Test the policy difference directly**: create one transfer of each policy with identical lines. Confirm the `immediate` one goes `approved → completed` in one Post click, while the `in_transit` one requires a second action (receive) before reaching `completed`. Also confirm `self-approval` is blocked here too (creator cannot approve their own transfer).

**Reverse** a `completed` transfer — confirm stock nets back to the source.

---

## Part 11 — Reports & Insights

*Module group: **Reports & Insights**. Dependency: everything above — reports are pure read-only queries against the ledger/source records, never a cached copy, so anything you post elsewhere should show up here immediately.*

All seven reports live as **tabs** in this module (no separate "hub" page — the launcher tile drops you straight into Inventory & Valuation). Every report has a filter row and a data table; several also show summary stat cards above the table.

| Report | What it answers | Key filters | Notable response fields |
|---|---|---|---|
| **Inventory & Valuation** | What do we have, where, and what's it worth? | Warehouse, category | `onHandQuantity`, `reservedQuantity`, `availableQuantity` (= on hand − reserved), `unitCost`, `valuation` (= on hand × unit cost) |
| **Stock Movement** | Every ledger transaction, paginated | Warehouse, transaction type, product | `transactionType` (`opening`\|`receipt`\|`issue`\|`return`\|`adjustment`\|`transfer`\|`reversal`), signed `quantity`, `referenceNumber` (the source document, e.g. a receipt number) |
| **Purchases & Suppliers** | PO activity and outstanding receiving | Supplier, warehouse, status, date range | `outstandingQuantity` (= ordered − received) per PO and rolled up per supplier |
| **Requests, Issues & Returns** | Fulfillment funnel: requested → issued → returned | Warehouse | Summary counts/quantities at each stage, plus a per-issue row |
| **Low & Out of Stock** | Products at/under their reorder level, or at zero available | Warehouse | `severity`: `out` (available = 0) vs `low` (available ≤ reorder level but > 0) |
| **Expiring & Expired** | Lots nearing/past expiry | Warehouse, "within N days" | `severity`: `expired` \| `critical` (≤7 days) \| `warning`; `daysUntilExpiry` |
| **Audit Trail** | Every sensitive action, success or denied | Resource type, action, actor, outcome, date range | `outcome` (`success`\|`denied`\|`failure`), `permissionUsed`, `reason` (the free-text reason captured at approve/reject/reverse time), `changedFields` |

**Test:** post a receipt, then immediately check Inventory & Valuation and Stock Movement without refreshing your login session — confirm the new numbers appear (proves it's a live query, not a stale cache). Try a *denied* action (e.g. attempt an action you don't have permission for) and confirm it shows up in the Audit Trail with `outcome: denied`.

---

## Part 12 — Approvals inbox

**Navigate:** the bell icon top-right, or Approvals in the nav.

Aggregates every `submitted` Purchase Order, Stock Request, Adjustment, Transfer, and Stock Count that's waiting on an approve-type permission you hold — across every module in one place, so an approver doesn't have to check five separate list pages. The badge count updates live as things get submitted/approved/rejected. Test: submit one document in each of the five modules from a clerk account, then confirm all five show up here (and only here-relevant ones) when you switch to a manager account.

---

## Part 13 — Profile & security

**Navigate:** avatar (top-right) → **Profile**.

- **Account tab**: your name, username, email, roles, MFA status (see note below), last login.
- **Change password**: current password + new password (min 8 characters) + confirm. On success, **every other active session for you is signed out** — test this by logging in on two devices/browsers, changing your password on one, and confirming the other gets kicked to the login page on its next request.
- **Active sessions**: lists every session with device/browser summary, last-active time, expiry, and a **Revoke** button per non-current session, plus a **Sign out all sessions** button. Test revoking a session from device A while logged in on device B — device B should be forced out.

**MFA note**: the backend supports TOTP-based multi-factor auth (`mfaEnabled` on the user record, an MFA challenge step at login), but there is **no in-app UI to enroll a device yet** — you cannot currently turn MFA on for a test account through the browser. Don't spend time hunting for an "Enable MFA" button; it doesn't exist in this build.

### 13.3 Forgot / reset password — full walkthrough

This is a three-page flow: **Forgot Password** → **Verify Code** → **Reset Password**. Each page only knows what the previous one handed it — you can't jump straight to Reset Password without a valid token, and you can't get a valid token without the right 6-digit code.

**Navigate:** Login page → **Forgot password?** link next to the Password field.

1. **Forgot Password page**: enter a username or email, submit. Whether or not it matches an account, you get the same generic confirmation and are sent to the **Verify Code** page with a `challengeId` in the URL — the app never reveals account existence at this step, and this is true even for a nonexistent account (see the business-rule table in Part 15).
2. **Verify Code page**: a 6-box OTP input. In dev (no real SMTP needed), a banner shows the code directly so you don't have to check a mailbox — type it in, or paste it, and it auto-submits once all 6 digits are entered. In production, or with SMTP configured locally, check the email instead — subject "Your `<app name>` password reset code", a large monospace 6-digit code.
   - **Test wrong code**: type any 6 digits that don't match. Expect an inline "Invalid or expired code." error, code field clears, you can retry.
   - **Test attempt limit**: get it wrong **6 times in a row** on the same challenge. Expect the challenge to become permanently invalid (same generic error) — go back to Forgot Password and request a fresh code to continue.
   - **Test expiry**: codes expire after 30 minutes; leave one unused that long, then try it — same generic invalid/expired error.
   - On a **correct** code, you're redirected straight to Reset Password with a fresh token in the URL — you never see or type this token yourself.
3. **Reset Password page**: new password (≥8 chars) + confirm. On success, shows a "Go to sign in" button and — per Part 13 above — **every other active session for that account is revoked**.

**Test the missing-token guard**: open `/reset-password` directly with no `?token=` in the URL — expect a "This reset link is missing its token" message with a link back to Forgot Password, not a crash. Same idea for `/verify-code` with no `?challengeId=` — expect an equivalent guard message, not a blank OTP box.

---

## Part 14 — End-to-end scenarios

Once you've touched every module individually, run these full chains to test the *seams* between modules, not just each module in isolation.

### Scenario A — Procure to stock
1. Create a Product (needs a Category + Unit first), a Supplier, a Warehouse with a Location.
2. Create a Purchase Order for that product/supplier/warehouse → Submit → Approve (as a second user).
3. Click **Receive** from the PO → fill received/accepted quantities, lot/expiry if required → Verify → **Post**.
4. Confirm: the PO's `receivedQuantity` updated and its status flipped to `fully_received`; the Inventory & Valuation report shows the new on-hand quantity; the Stock Movement report shows a `receipt` row referencing the receipt number; **Close** the PO.

### Scenario B — Request to issue to return
1. As a Requester-type user, create a Stock Request for stock that exists (from Scenario A) → Submit.
2. As a Store Manager, **Approve** it (confirm self-approval is blocked if you try it as the requester first).
3. Click **Issue** from the approved request → review the auto-picked FEFO/FIFO lines → **Post**.
4. Confirm: the request moved to `fulfilled`; available stock decreased; the Requests/Issues/Returns report reflects it.
5. From the posted issue, create a **Return** for part of a line with condition `damaged` → Post.
6. Confirm: available stock did **not** increase by the returned amount (it should route to a non-available state instead), and the issue line shows the return quantity.

### Scenario C — Cycle count correcting a discrepancy
1. Create a Stock Count (`cycle` scope) covering the product from Scenario A, blind count on.
2. Enter a counted quantity deliberately different from the system quantity.
3. Submit → Approve (second user) → Post.
4. Confirm the variance posted as a ledger adjustment and the balance now matches what was counted.

### Scenario D — Transfer between warehouses
1. Create a second Warehouse with a Location.
2. Transfer some of the product from Scenario A's warehouse to the new one, `in_transit` policy.
3. Submit → Approve → Post (now `in_transit`) → Receive at destination (now `completed`).
4. Confirm the source warehouse's available stock decreased and the destination's increased, with a `transfer` row in Stock Movement for each side.

---

## Part 15 — Cross-cutting business rules to deliberately violate

Use this as a checklist — each row should be tried at least once somewhere in the system:

| Rule | Where to try breaking it | Expected |
|---|---|---|
| Self-approval blocked | PO, Stock Request, Adjustment, Transfer, Stock Count — approve your own | `403 FORBIDDEN`, message names the document type |
| Negative available stock blocked | Post a Stock Issue for more than available | `422 BUSINESS_RULE_VIOLATION`, "Insufficient available stock..." |
| Idempotency replay = one movement | Retry the exact same post request (same Idempotency-Key) | Second response returns the same result, no second ledger row |
| Idempotency key reuse with different payload | Same key, different body, on a second post | `409` conflict |
| Posted documents are immutable | Try editing any field on a posted/completed/fulfilled document via the API directly (not reachable via UI buttons) | Rejected — only reversal-type documents can touch it |
| Decimal precision preserved | Enter a quantity like `0.001` on a unit with enough decimal places | Round-trips exactly, no floating-point drift |
| Status-transition guard | Try to Post a `draft` document (skip Verify/Submit/Approve) via direct API call | `422`, names the illegal `from → to` transition |
| Org scoping | N/A in this single-org build — noted for completeness | — |
| Generic auth error messages | Wrong password vs. deactivated account vs. locked account vs. nonexistent username | All four show the identical generic message |
| Reset-code enumeration blocked | Forgot Password with a real account vs. a nonexistent one | Identical response shape both times (a `challengeId`, never distinguishable), and guessing codes against either fails identically |
| Reset-code attempt limit | 6+ wrong codes against one challenge | Challenge permanently invalidated, same generic error every time (not a distinct "too many attempts" message) |
| Rate limiting | Hammer the login endpoint rapidly | `429` with `Retry-After`, distinct from account lockout |
| Archived master data can't be used in new documents | Archive a Product/Supplier/Warehouse, try selecting it on a new PO/receipt | Unselectable or rejected on submit |

---

## Part 16 — Error reference

| HTTP status | Error code (in the response envelope) | What it means | What to check |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/malformed field, or a required header (e.g. `Idempotency-Key`) absent | The field-level `errors` array in the response |
| 401 | — | No valid session | Are you logged in? Did your session expire (check idle/absolute timeout)? |
| 403 | `FORBIDDEN` | You lack the permission, or a separation-of-duty rule blocked you (self-approval) | Check your role's permissions on the Permissions page; check if you created the document you're trying to approve |
| 404 | — | Record doesn't exist, or belongs to a different org | Check the id in the URL |
| 409 | — | Idempotency key reused with a different payload, or a uniqueness conflict (duplicate SKU/code/username) | — |
| 422 | `BUSINESS_RULE_VIOLATION` | A domain rule was violated: insufficient stock, illegal status transition, over-return, self-approval on some paths, math mismatch (accepted+rejected≠received) | The `message` field is written to be specific — read it, it usually names the exact rule |
| 429 | — | Rate limit hit | Check `Retry-After` header; distinct from account lockout (which returns the generic auth message, not 429) |
