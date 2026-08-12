# Manual Testing Guide (browser, data entry)

This is a click-through script for testing the system **by hand, in the browser** — what to type into each form, which invalid values to try on purpose, and what the system is supposed to do in response. It's the companion to [`TESTING_GUIDE.md`](./TESTING_GUIDE.md), which covers the same rules from the API/curl side; use that one when you need the exact endpoint, status code, or a `mongosh` query, and this one when you're sitting at the app clicking buttons.

**Status: covers Phases 0–6 plus the Reports slice of Phase 7** (same scope as `TESTING_GUIDE.md`). Alerts and queued exports aren't built yet — don't go looking for them.

Every numbered step below assumes you're testing against a freshly seeded, otherwise-empty database (`pnpm docker:up`, `pnpm db:migrate`, `pnpm --filter @inventory-ms/api run seed`, `pnpm dev`). If you're testing against a database with existing data, the exact numbers in "expected result" sections (balances, counts) won't match — the *behavior* described still will.

---

## 1. Before you start

### 1.1 Accounts you'll need

Several tests below require **two different accounts** on purpose — self-approval is blocked by default everywhere (a purchase order, stock request, adjustment, transfer, or count creator cannot approve their own document). Create these once, at the start:

1. Log in as the seeded admin (`admin` / the password printed by the seed script). The admin has every permission and can approve their own documents in some flows if the app doesn't stop them — **use the admin only for setup (catalog, suppliers, warehouses)**, not for testing approval flows.
2. Go to **Users & Access → Users → New user**. Create:
   - **`clerk1`** — assign a role with create/submit-type permissions (or reuse the seeded **Inventory Clerk** role).
   - **`manager1`** — assign a role with approve/post-type permissions (or reuse the seeded **Store Manager** role).
3. Log out and confirm you can log in as both. Keep two browser profiles (or one normal + one incognito window) open side by side so you can act as the creator in one and the approver in the other without constantly logging in and out.

### 1.2 Reading the results

Every list/detail page shows a colored status **badge**. The four colors mean the same thing everywhere in the app: outline/gray = draft or not-yet-started, amber = in progress/awaiting a decision, green = successfully completed/posted, red = rejected. Learn to read the badge before reading the label — it's faster once you've done a few modules.

### 1.3 Where things live now

The launcher (`/apps`, click the app-logo icon top-left) is a grid of **10 app tiles**, each a distinct color: Users & Access, Organization, Catalog, Suppliers, Procurement, Receiving, Requests & Issues, Adjustments & Counts, Transfers, Reports & Insights. Open a tile and its sibling pages appear as **tabs in the top bar** (e.g. inside Users & Access you'll see Users / Roles / Permissions tabs) — you don't need to go back to the grid to switch between them. Hover the top-left icon and it turns into a back arrow; click it to return to the grid.

The **Approvals bell** (top-right, next to your avatar) shows a red badge with the count of documents across every module that are `submitted` and waiting on a permission you hold. Click it any time you're not sure what needs your attention — this is the fastest way to find pending work without hunting through each module's list.

---

## 2. System Settings & Configuration

### 2.1 Users

Navigate: **Users & Access → Users → New user**.

| Field | Try (valid) | Try (invalid) | Expected |
|---|---|---|---|
| Full name | `Jordan Rivera` | (empty) | Required-field error, no submit |
| Username | `jrivera` | `jrivera` again on a second user | "Duplicate" / uniqueness error — usernames are unique per organization |
| Email | `jordan@example.test` | `not-an-email` | Email format error |
| Role | pick one seeded role | leave unassigned | Should still be allowed to save with zero roles (a user with no roles has no permissions — confirm they see "no modules available" on login) |

- **Activate/Deactivate**: open a user, toggle status. A deactivated user should fail to log in (test this in a second browser/incognito) with the same **generic** error message as a wrong password — the system must not reveal *why* the login failed.
- **Password reset flow**: use "Forgot password" on the login screen with a real and a fake email. Both should show the identical generic confirmation message ("if an account matches..."). This is deliberate — don't report it as a bug that the fake email doesn't error differently.
- **Repeated failed logins**: try a wrong password 10+ times in a row for one account. It should eventually lock (generic error still, but now failing even with the correct password) — this proves account lockout is active, not just rate limiting.

### 2.2 Roles

Navigate: **Users & Access → Roles → New role**.

- Create a role with only `products.view` checked. Assign it to a test user. Log in as that user: only the Catalog tile should be reachable, and only in read-only form (no "New product" button, no edit/archive actions).
- Try to **rename a system-seeded role** (Administrator, Store Manager, Inventory Clerk, Requester, Auditor) — the system should refuse to delete/rename these (`isSystem` roles are protected), though editing their permission set may be allowed.

### 2.3 Permissions

Navigate: **Users & Access → Permissions**. Read-only by design — there's no create/edit here. Confirm:
- The search box filters by permission name/description.
- Each module tab's table shows a risk badge (low/medium/high) — approve/post/reverse/reject/cancel/manage/deactivate/archive actions should always show **high**, create/update/submit-type actions **medium**.

---

## 3. Organization, Catalog, and Suppliers

### 3.1 Organization / Departments / Warehouses

Navigate: **Organization** tile.

- **Warehouses → New warehouse**: create at least two (e.g. `Main Warehouse` / `MAIN`, `Overflow Warehouse` / `OVERFLOW`) — you'll need two for the Transfers tests later. Try creating a second warehouse with the same `code` as the first — expect a uniqueness error.
- Inside a warehouse, add at least two **storage locations** (e.g. `Receiving Dock`, `Shelf A1`) — every receipt, request, issue, adjustment, transfer, and count line needs a location.
- **Archive** a warehouse that has no stock in it — confirm it disappears from "create new document" pickers elsewhere (e.g. it should no longer be selectable when creating a new Purchase Order) but still shows correctly on any already-posted historical document that references it.

### 3.2 Catalog

Navigate: **Catalog** tile.

1. **Categories → New**: e.g. `Beverages` / `BEV`.
2. **Units → New**: e.g. `Each` / `ea`, `Case of 12` / `case12`.
3. **Products → New product**: create at least three products you'll reuse for the rest of this script:
   - `SKU-001` "Bottled Water 500ml" — `trackLots: off`, `trackExpiry: off`, reorder level `20`.
   - `SKU-002` "Milk 1L" — `trackLots: on`, `trackExpiry: on`, expiry warning days `14`, reorder level `10`.
   - `SKU-003` "Canned Beans" — `trackLots: off`, reorder level `0` (deliberately zero, to test the low-stock report's "reorderLevel 0 never shows as low, only out" rule later).

| Field | Try (invalid) | Expected |
|---|---|---|
| SKU | Duplicate an existing SKU | Uniqueness error |
| Purchase price | `-5` | Rejected — money/quantity fields never accept negative here |
| Purchase price | `12.3456789` | Either rejected or silently rounded — check which; report the actual behavior, this is worth pinning down precisely |
| Reorder level | `abc` | Rejected — must be a decimal string |

- **Archive a product**, then try to add it to a new Purchase Order line — it should not appear in the picker. Then open an *existing* posted document that already references it — it should still display correctly.

### 3.3 Suppliers

Navigate: **Suppliers** tile → **New supplier**. Create at least one, e.g. `Acme Beverages` / `ACME-BEV`. Same duplicate-code rule as warehouses/categories/units applies.

---

## 4. Procurement and Receiving

### 4.1 Purchase Orders

Navigate: **Procurement** tile → **New purchase order**. As `clerk1`:

1. Supplier: `Acme Beverages`. Warehouse: `Main Warehouse`.
2. Lines: `SKU-001` qty `100` @ `1.00`; `SKU-002` qty `50` @ `2.50`.
3. Save as draft, then **Submit**.
4. Log in as `manager1`, open the same PO (or find it via the **Approvals bell**), and **Approve** it.

Things to specifically try:
- **Self-approval**: while still logged in as `clerk1`, try to approve the PO you just created (if your test role has `purchase_orders.approve`) — expect a `403`-style denial, not a silent success.
- **Edit after submit**: try to edit line items on a `submitted` PO — the edit form should refuse (only `draft` POs are editable).
- **Reject**: create a second PO, submit it, and reject it as `manager1` with a reason. Confirm the reason is visible on the PO detail page, and that there's no way to post/receive against a rejected PO.
- **Cancel**: create a third PO and cancel it directly from `draft` — should succeed without needing approval first.

### 4.2 Goods Receipts

Navigate: **Receiving** tile → **New goods receipt**, linked to the PO you approved in 4.1.

1. Pick the approved PO — the form should prefill supplier/warehouse and the two outstanding lines.
2. For `SKU-001`: received `100`, accepted `100`, condition `good`, destination location `Shelf A1`.
3. For `SKU-002` (lot + expiry tracked): received `50`, accepted `45`, rejected `5`, condition `good`, **lot number required** — try leaving it blank first and confirm the form blocks you; then fill `LOT-MILK-001` and an expiry date ~10 days out (inside `SKU-002`'s 14-day warning window, useful later for the Expiry report).
4. Save, then **Verify**, then **Post**.

Expected results to check:
- `SKU-001` available balance should read `100`.
- `SKU-002` available balance should read `45` (not `50` — the rejected `5` never enters stock).
- The PO's status should now show `partially_received` or `fully_received` depending on whether you received everything ordered.
- **Reverse** this receipt (reason required) and confirm the balances net back to zero and the PO's received quantity drops back down — the original receipt stays visible and marked reversed, it does not disappear.
- Try to **post a receipt that hasn't been verified** — should be blocked.
- Try posting the **same receipt twice in a row very quickly** (double-click Post) — you should end up with the balance increased exactly once, not twice (idempotency).

---

## 5. Requests, Issues, and Returns

### 5.1 Stock Requests

Navigate: **Requests & Issues** tile → **New stock request**. As `clerk1`, request `SKU-001` qty `30` from `Main Warehouse`. Submit. As `manager1`, **Approve** (default approves the full requested quantity).

- Confirm the product's **reserved** quantity increases by `30` (check the Inventory report or the request detail page) and **available** drops by the same amount, while **on hand** stays unchanged — approval reserves, it doesn't move stock.
- Try approving a request for more than is currently available (e.g. request `999999` of `SKU-003`, which has zero stock) — expect a rejection naming the insufficient quantity, and confirm nothing was reserved.
- **Cancel** an approved request and confirm the reservation is released (reserved quantity drops back down).

### 5.2 Stock Issues

From the approved request's detail page, click **Issue** (only visible once approved). This auto-picks lines using FEFO/FIFO — for `SKU-002` (lot-tracked) it should pick the specific lot you received in 4.2.

1. Review the auto-picked line(s), click **Confirm pick**, then **Post**.
2. Confirm `SKU-001`'s on-hand balance dropped by `30` and its reservation is released.
3. Try to **post an issue whose picked quantity exceeds what's physically on hand** — set this up by picking two overlapping issues against a small balance and posting both back-to-back; exactly one should succeed and the other should fail with an insufficient-stock error, never a negative balance.
4. **Reverse** a posted issue and confirm stock returns and the source request's fulfilled quantity walks back down.

### 5.3 Stock Returns

From a **posted** issue's detail page, click **Return**. Return part of the picked quantity (e.g. `10` of the `30` issued), condition `good`. Post it.

- Confirm available balance increases by the returned amount.
- Try returning **more than was picked** (or returning the same line a second time past what's left outstanding) — expect a rejection naming the outstanding amount.
- Create a second return with condition `damaged` — confirm the returned stock lands in a **damaged** state, not `available` (check the Inventory report; a damaged-condition return should not increase the "available" figure you'd get by summing on-hand naively).

---

## 6. Adjustments, Transfers, and Counts

### 6.1 Stock Adjustments

Navigate: **Adjustments & Counts** tile → **New stock adjustment**. As `clerk1`: warehouse `Main Warehouse`, reason `count_correction`, line `SKU-003` at location `Shelf A1`, delta `+50` (positive — this product had zero reorder level and zero stock so far). Submit, approve as `manager1`, post.

- Confirm `SKU-003`'s on-hand balance is now `50`.
- Create a second adjustment with a **negative** delta larger than what's on hand (e.g. `-9999` on `SKU-001`) — approve it, then try to **post** it: expect a rejection, and confirm the balance is untouched (the rejection must happen atomically, not partially).
- Create an adjustment whose total absolute delta is **≥ 100** units — after creating it (before submitting), its detail page should show a "Material" badge. This is informational only in the current build — it doesn't require a different permission to approve, and there's no MFA step-up prompt; that's a known limitation, not a bug.
- **Reject** a submitted adjustment and confirm posting is blocked afterward.

### 6.2 Stock Transfers

Navigate: **Transfers** tile → **New transfer**. Source `Main Warehouse` / `Shelf A1`, destination `Overflow Warehouse` (pick any location there), product `SKU-001`, quantity `20`.

- **Immediate policy**: create one with `inTransitPolicy: immediate`, submit, approve, **Post** — confirm it goes straight to `completed` and the destination's available balance increases in the same step.
- **In-transit policy**: create a second one with `inTransitPolicy: in_transit`, submit, approve, **Post** — confirm status becomes `in_transit` (not `completed`) and the *source* warehouse's balance has already dropped, but the destination's *available* balance has **not** increased yet. Then click **Receive** — now the destination's available balance increases and status becomes `completed`.
- Try creating a transfer where source and destination **location** are the same — the form should block this before it even reaches the server.
- **Reverse** a completed transfer and confirm stock moves back to the original source.

### 6.3 Stock Counts

Navigate: **Adjustments & Counts** tile → **Stock Counts** tab → **New count**. Warehouse `Main Warehouse`, scope `cycle`, blind count **on**, lines: `SKU-001` @ `Shelf A1`.

1. Save — the system snapshots the current system quantity for that line immediately (this happens at creation, there's no separate "start" step).
2. Open the count. Because blind count is on, you should **not** see the system quantity yet — only a blank field to enter what you counted.
3. Enter a counted quantity that's deliberately *different* from the real on-hand (e.g. off by 5), **Save counts**, then **Submit** — now the variance should be visible.
4. Try submitting a count **before** entering every line's counted quantity — should be blocked with a message naming the uncounted line.
5. Approve (as `manager1`) and **Post** — confirm the balance changes by exactly the variance amount, using the same signed-adjustment mechanism as section 6.1.
6. **Reverse** it and confirm the balance returns to what it was before posting.

---

## 7. Reports & Insights

Navigate: **Reports & Insights** tile. For each report, the goal is to confirm the numbers **reconcile** against what you did in sections 4–6, not just that the page loads.

- **Inventory & valuation**: filter by `Main Warehouse`. `SKU-001`'s on-hand should match what you'd hand-calculate from every posted receipt/issue/adjustment/transfer/return above. Valuation = on-hand × purchase price — spot-check the arithmetic.
- **Stock movement**: filter by `SKU-002`. You should see one row per posted transaction touching it (receipt, issue, any reversal) in reverse-chronological order, with a running "total in / total out / net" summary that matches.
- **Purchases & suppliers**: confirm the PO(s) from section 4.1 show correct outstanding quantity (`ordered − received`), and the supplier-activity table's totals match the row-level data above it.
- **Requests, issues & returns**: confirm the summary counts match how many requests/issues/returns you posted in section 5.
- **Low & out of stock**: `SKU-003` has `reorderLevel: 0` — even after you drop its stock to zero (issue it all out), it should **not** appear here (severity `low` requires `reorderLevel > 0`); it would only appear once on-hand hits exactly zero or below, under severity `out`, regardless of reorder level. This distinction is easy to get backwards — verify it explicitly, don't assume.
- **Expiring & expired stock**: `SKU-002`'s lot from section 4.2 (expiry ~10 days out, within the 14-day warning window) should appear with severity `critical` if within 7 days of expiry, `warning` otherwise. Widen/narrow the "within days" filter and confirm the row appears/disappears accordingly.
- **Audit trail**: filter by `outcome: denied` — you should see every permission-denial you triggered while testing (e.g. the self-approval attempt in 4.1, or any 403 you deliberately caused). Every sensitive action across every module you just tested should be traceable here with actor, action, resource, and — for reject/reverse/cancel actions — the reason you typed.
- **Export CSV** on any report: confirm the downloaded file's rows match what's on screen. This is a client-side export of the currently loaded data only — it is not a background job and there's no download-later queue (see the Known Limitations below).

### 7.1 Approvals inbox

Navigate to the **Approvals bell** at any point while you have unactioned `submitted` documents sitting around from the sections above. Confirm:
- Every submitted PO/request/adjustment/transfer/count you're allowed to approve shows up, across every module, in one list.
- The badge count on the bell matches the number of rows on the page.
- Clicking a row takes you to that specific document's own detail page (where the actual Approve/Reject buttons live — the inbox itself is a finder, not a place to approve from directly).
- Log in as a user with **no** approve permissions anywhere — the bell should show no badge and the page should read empty, not error.

---

## 8. Known limitations (don't file these as bugs)

- **No queued/async report exports.** "Export CSV" downloads exactly what's loaded in your browser right now. The doc's designed flow (submit an export job, come back later, download a signed link) isn't built.
- **No Alerts module.** The Low-Stock and Expiry *reports* are live queries you have to open manually — there's no standing, deduplicated alert record, no notification, no scheduled background evaluation.
- **No line-by-line pick editor in the Stock Issues UI.** The auto-allocated FEFO/FIFO picks are shown read-only; you can't manually swap which lot gets picked from the browser (the API supports it, the UI doesn't yet).
- **No per-line partial-approve UI on Stock Requests.** The Approve button approves every line in full; partial per-line approval exists in the API only.
- **No lot selection in the Stock Transfers create form.** Only untracked stock can be transferred from the UI today.
- **Material-adjustment flag is informational only.** No extra permission or MFA step-up is enforced for large adjustments yet.
- **No pagination on most report/list pages** except Stock Movement and Audit Trail — fine at the data volumes you'll generate manually, would need addressing at real scale.
- **Backups, restore drills, and load testing (Phase 8)** don't exist yet — don't look for them.

---

## 9. If you find an actual bug

Note down: which module, which exact field/button, what you entered, what you expected, what actually happened, and the **status badge / error text** shown. If it's a validation gap (something invalid got accepted) or an authorization gap (an action succeeded that should have been denied), flag it as high priority — those are exactly the categories this system's design treats as non-negotiable.
