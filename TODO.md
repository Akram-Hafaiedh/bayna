# Bayna – Project TODOs

Last updated: 15 Oct 2026 (permission layer done; backlog ideas added)

Product: **local marketplace** (estimates + multi-provider orders). Price comparison is a feature, not the whole business.

Design details for access control, audit, impersonation and support live in
[`docs/access-audit-support.md`](docs/access-audit-support.md). This file stays a task list.

---

## Current focus

**Done and verified: audit columns, `ActivityLog`, permission layer, `withAudit` on every write, the provider profile with map pin and admin review (16 Oct 2026).** Notifications (Phase 7b) are built and verified; more event types are added by each later module. The
answers to the open design questions were recorded on 16 Oct 2026 in
[Decisions of 16 Oct 2026](#decisions-of-16-oct-2026-answers-to-the-open-questions). The execution order
is in [Next up](#next-up-execution-order). The backlog ideas from 15 Oct 2026 are in
[Backlog ideas](#backlog-ideas-added-15-oct-2026-not-started): not started, not ordered.

---

## Roles & Dashboards

| Role         | How assigned                         | Dashboard URL          |
|--------------|--------------------------------------|------------------------|
| **CLIENT**   | Default on registration              | `/dashboard`           |
| **PROVIDER** | Apply after CLIENT (+ admin approval) | `/provider/dashboard` |
| **ADMIN**    | Manual only (see below)              | `/admin/dashboard`     |

Planned (Phase 7): authorization moves from the global role to **permissions**. Platform staff
(super admin, support, catalogue manager, ...) and shop staff get roles through one assignment
table, so the `User` table never has to change again. The global role stays only for routing.

### How to make a user ADMIN

Option 1 – Prisma Studio:
```bash
npx prisma studio
# Open User table → set role = ADMIN
```

Option 2 – SQL:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Option 3 – Seed script (later): create first admin on `npx prisma db seed`.

Never expose admin promotion in the public UI.

---

## Phase 0 – Foundation
- [x] Project name, vertical, repo, Next.js, Prisma, NextAuth
- [x] README, TODO, .env.example
- [x] Rename BUYER → CLIENT
- [x] Position product as marketplace (orders, estimates, multi-provider); comparison is a feature

## Phase 1 – Core Data Model
- [x] Roles, Provider, Product, Category, location fields
- [x] LoginSession model (device/session tracking)
- [x] passwordChangedAt on User
- [x] Unit enum (piece, bag, m, m², m³, ton, roll, liter, other)
- [x] CatalogItem model (shared catalogue, optional link from Product)
- [x] Category improvements (parent/child, sortOrder, description)
- [x] Seed: construction (16 categories) + auto parts (12 categories) with catalogue items
- [x] CatalogSuggestion model (provider → admin review → link or merge)
- [x] Audit columns on **every** table (createdAt, updatedAt, createdById, updatedById; soft-delete columns on business tables). Migration written and tested; apply with `prisma migrate dev` (see Phase 7)
- [x] `ActivityLog` model (append-only timeline), written by database triggers (see Phase 7)
- [x] `AccessRole` + `AccessAssignment` models (permissions), written, not yet migrated on your machine (see Phase 7)
- [ ] Order / OrderProvider / OrderItem models (multi-provider split, price/name/unit snapshots)
- [ ] Estimate / cart strategy (DB for logged-in users; convert to order on confirm)

## Phase 2 – Auth (mostly done)
- [x] Register (always CLIENT) / Login
- [x] Session helpers + role-protected dashboards
- [x] Forgot / Reset password
- [x] Lock auth pages for logged-in users
- [x] Role-aware Navbar (logo + avatar only)
- [x] Profile page (name, phone)
- [x] Change password (old + new) from profile
- [x] Send reset link while logged in
- [x] After password change → modal to revoke other sessions
- [x] Active sessions list on profile
- [x] Route protection via proxy.ts (auth + role gates)
- [ ] Enrich LoginSession with real userAgent / IP on login (`authorize()` receives the request; today the label is hard-coded "Web browser")
- [ ] Google / Facebook OAuth
- [ ] 2FA (TOTP, authenticator app + recovery codes). **Decided 16 Oct 2026:** mandatory for SUPER_ADMIN and for any staff who can impersonate (`impersonation.session.*`), optional for providers and clients. Impersonation cannot start unless 2FA is on. SMS / WhatsApp codes stay open (see backlog A)

## Phase 3 – Provider Side

### 3a – Onboarding & shop identity  ← **NEXT, right after the Phase 7 foundation**
- [x] “Become a Provider” application flow (pending until admin approves)
- [x] **Provider profile page** (view + edit) — built 16 Oct 2026 (`/provider/profile`): businessName, description, phone, WhatsApp, address, city, governorate
- [x] `PATCH /api/provider/profile` with input validation (same style as `lib/product-input.ts`)
- [x] Location, **decided 16 Oct 2026:** coordinates must be reliable for the address, shown on a map. Governorate lookup gives the starting point, then the provider confirms or moves a **map pin** himself (map picker is part of this task, not later); store how it was set (lookup / pin / address search). The same map component is reused for the public map of shops in Phase 4. Governorate coordinates come from a cited source (English Wikipedia, 16 Oct 2026), not from memory. Governorates are a TypeScript constant (`lib/governorates.ts`), not a database table. Admin side: `needsReview` flag, “needs review” filter and “Mark reviewed” button on `/admin/providers`
- [x] Show verification status on the profile. **Decided:** phone, WhatsApp and description save and log only; business name, address, city, governorate and location save, log and set `needsReview` for the admin (the shop stays live)
- [x] Pending applicants can edit or withdraw their application (`PATCH` / `DELETE /api/provider/apply`, UI under `/become-provider`, because they are still CLIENT and cannot reach `/provider`)
- [x] Write an `ActivityLog` entry with before/after values (audit columns come from Phase 7)
- [x] Guard the route with `requireShop("shop.profile.edit")` from Phase 7
- [ ] Optional later: opening hours, logo, delivery / pickup / COD options, open / closed / vacation status, public shop page
- [x] **Decided 16 Oct 2026:** a provider has **several warehouses**, with stock tracked per warehouse (see “Decisions of 16 Oct 2026”, 1). The shop's own pin (profile) stays the shop / head-office location

### 3b – Listings & pricing
- [x] Product management (add / edit / stock)
  - [x] List own products (server-side search, filters, sort, pagination)
  - [x] Create product (link to CatalogItem or free-form niche item)
  - [x] Edit product: price, stock, active flag
  - [ ] Edit product: **images**. **Deferred 16 Oct 2026:** no storage service chosen (the candidates are not free and coverage in Tunisia is uncertain). Products show a placeholder until then; revisit when the shop count justifies a paid plan
  - [x] Delete is now a **soft delete** (`deletedAt`). Removed products sit in **Trash** (`/provider/products/trash`) and come back with **Restore** (needs `product.listing.restore`, owner and manager). Adding a trashed catalogue item again is refused ("restore it from your Trash"), never restored silently. On restore a linked product takes the catalogue's current unit and category, and is flagged for a price check if the unit changed; a catalogue item archived meanwhile blocks the restore. Delete offers **Undo** in a toast (built 18 Oct 2026)
  - [ ] Permanent removal of old trash (retention rule) once orders exist and show what must be kept. Today nothing is ever purged
- [x] Product form redesign: choose catalogue vs custom up front, short linked form, one action bar
- [x] Suggest a custom product for the catalogue on create (CatalogSuggestion)
- [ ] Suggest an existing custom product for the catalogue from edit
- [x] Inline / quick edit of price and stock on the products table (built 17 Oct 2026; each field needs its own permission)
- [ ] Bulk edit, CSV import / export, quick-add from the catalogue
- [ ] Price history. **Done 17 Oct 2026:** the "price last confirmed" date (`priceUpdatedAt`, shown in the products table; null means unknown for older products). The history of past prices is R3
- [ ] **Custom taxes per shop. Decided 16 Oct 2026** (see “Decisions of 16 Oct 2026”, 2): the provider enters the price before tax (HT), applies one or several of his own taxes (percentage or fixed, calculated on the base or on the running total), buyers always see the tax-inclusive price (TTC); tax changes never need a developer
- [ ] Quantity price tiers (by pallet / ton) and delivery fee

### 3c – Orders & operations (marketplace core for the provider)
- [ ] Provider order inbox (only their OrderProvider slice)
- [ ] Fulfillment statuses (new → accepted → preparing → ready → completed / cancelled)
- [ ] Stock handling: treat an order as a request; no hold at estimate; decrement on accept; restore on cancel
- [ ] Dashboard beyond product stats: open orders, low-stock alerts, products waiting for a price review (catalogue unit changed), pending suggestions
- [ ] Notifications on new orders (email first; WhatsApp later)
- [ ] Assign an order to an employee; order status history (customer-visible)

### 3d – Team (schema + guard early, UI when a shop needs a second login)
**Policy:** build the data model, the permission guard and the audit hooks now so nothing has to be
retrofitted. Build invites and the team page when the first shop needs a second login.
Admin and Client do **not** get shop membership.
- [ ] Shop membership through `AccessAssignment` (scope SHOP) instead of `Provider.userId` only; migrate existing owners to OWNER rows
- [ ] Replace `getVerifiedProvider()` / `requireProvider()` with a provider context: provider + roles + `can(permission)`
- [ ] Stop gating `/provider` on the global role in `proxy.ts`; derive it from an active membership. Let provider users also act as clients
- [ ] Invite by email (token + expiry); needs real email sending first
- [ ] Team page: invite, change role, suspend / remove; protect the last owner; removing a member revokes their sessions
- [ ] Activity page for owner / manager (filter by member and entity) + "last changed by" on product and order pages
- [x] **Decided 16 Oct 2026:** one person can work for several shops. Shop switcher in the navbar, `activeProviderId` in a cookie, guards check it against the person's live assignments (see “Decisions of 16 Oct 2026”, 5). Not built yet

### 3e – Shop lifecycle & insights
- [ ] Shop states: suspended and temporarily closed (today only `isVerified`)
- [ ] Provider insights: views, times compared, position vs cheapest in the city

## Phase 4 – Client Side (marketplace)
- [ ] Public search (catalogue items + free-form products; by name, category, location)
- [ ] Comparison page per CatalogItem: offers by price with stock, minimum order, city and price age
- [ ] Client location (city picker, no account needed)
- [ ] Distance + estimated travel cost (haversine, configurable per-km rate)
- [ ] **Estimate (cart / quote)**: multi-provider lines, live totals
- [ ] **Checkout → Order**: confirm the estimate into a multi-provider order
- [ ] Client order history and status (per-provider progress; overall status derived from the slices)
- [ ] Pickup / COD preferences per provider slice
- [ ] Client dashboard (currently a placeholder)

## Phase 5 – Admin Side
- [x] Admin Dashboard (Basic)
- [x] Admin List Users (Basic)
- [x] Admin List Providers (With Filters)
- [x] Admin review of catalogue requests (approve as new item, merge into existing, reject)
- [x] Admin Manage Categories (create, rename, move, reorder; two levels)
- [x] Admin Manage CatalogItems (add / edit / deactivate; unit and category changes update linked products)
- [x] Edit catalogue request details before approving
- [ ] Delete / soft-archive categories (rules when items or products still reference them)
- [ ] Seed re-runs overwrite name, unit and category of seeded items; make the seed skip items the admin edited
- [ ] Reject API deletes any provider, including a verified one (cascades all their products). Guard it, or replace with suspend
- [ ] Suggestion approval: create the catalogue item inside the same transaction and re-check `PENDING` inside it (concurrent approvals)
- [ ] User management: suspend / reinstate, force password reset, revoke sessions
- [ ] Platform staff accounts and roles (see Phase 7)
- [ ] Order oversight / disputes
- [ ] Global audit view

## Phase 6 – Tunisia Polish
- [ ] i18n (FR + AR); `nameAr` is stored and edited but never shown to clients
- [ ] COD / pickup flows (UX + status machine)
- [x] Expand catalogue: auto / car parts (seeded)
- [ ] Expand catalogue: hardware store
- [x] Seed demo providers + sample products with prices (prisma/seed-demo.ts)

## Phase 7 – Access control, audit and timelines (cross-cutting)
Full design and the permission catalogue: `docs/access-audit-support.md`.

**Permissions and roles**
- [x] Permission keys as typed code constants (`module.resource.action`) in `lib/access/catalogue.ts`: 71 shop, 98 platform, 24 client keys
- [x] `AccessRole` table (system roles; custom shop roles possible later via `providerId`) + `AccessAssignment` (user, scope PLATFORM / SHOP, providerId, role, status, grants, denies, expiresAt, invitedById). Needs the migration steps below
- [x] Resolution: role permissions + grants − denies; deny wins; computed per request (`lib/access/evaluate.ts`), not stored in the JWT. No cross-request cache yet, so changes apply on the next request
- [x] Guard API used by every existing admin and provider API route: `requirePlatform(key, req)` and `requireShop(key, req)` in `lib/access/guard.ts`; `isAdmin()`, `getVerifiedProvider()` and the inline role checks are gone. Refuses non-ACTIVE users (401 not signed in, 403 not allowed). Pages still route by `User.role`; only `requireProvider()` now finds the shop through its assignment
- [ ] Same guard for the routes that are not admin/provider yet (client order routes, profile) when they need permissions; page-level guards for admin pages
- [ ] Test that fails when an API route has no guard (the unit tests cover the evaluator and the roles, not the routes)
- [ ] Step-up (recent password) for sensitive actions: role changes, impersonation, ownership transfer
- [x] System roles defined in `lib/access/roles.ts` (8 platform, 6 shop) and stored by `npm run access:sync`, which also makes today's admins SUPER_ADMIN and gives each verified shop's applicant the OWNER role. Approving a shop now creates the OWNER assignment
- [ ] Price/stock rule is enforced in the product routes (`product.price.edit`, `product.stock.edit`); `product.listing.publish` exists but nothing checks it yet
- [ ] Staff and team members need a way into the dashboards: `proxy.ts` still routes by `User.role` (shop staff would need role PROVIDER, platform staff ADMIN). Decide with the team module

**Audit columns and timelines**
- [x] Audit columns on every table: `createdAt`, `updatedAt`, `createdById`, `updatedById`. The actor columns are plain ids with no foreign key (decided 15 Oct 2026), so adding a table never means editing `User`
- [x] Soft-delete columns (`deletedAt`, `deletedById`) on User, Provider, Product, CatalogItem, Category. Nothing filters on them yet and routes still hard-delete
- [ ] Soft delete behaviour: filter on `deletedAt`, replace the hard deletes, partial unique indexes (`WHERE "deletedAt" IS NULL`) for `Product (providerId, catalogItemId)` and the slugs. Add the columns to orders and tickets when those tables exist
- [x] Stamp the actor automatically with **database triggers** (`audit_stamp`, `audit_log`) reading the actor from the transaction setting `app.audit`. New tables call `SELECT audit_attach('Name')` in their migration
- [x] `withAudit(actor, tx => ...)` and `logActivity()` in `lib/audit/`
- [x] `withAudit` in every write route (15 Oct 2026): the 15 admin and provider routes use `guard.actor`; register, forgot / reset password, profile, change password, revoke sessions and provider apply use `actorFromSession` with the request's IP and browser. Anonymous requests (register, forgot / reset password) have no actor id; the email is recorded as the actor name. Written, not yet compiled or clicked through
- [ ] Writes still outside `withAudit`: the `LoginSession` rows created, touched and revoked in `auth.ts` (sign-in, activity, sign-out), and the seed scripts. Login events get their own entries with `logActivity`
- [ ] Seeds (`prisma/seed.ts`, `prisma/seed-demo.ts`): use `systemActor("SEED")` so their rows are labelled (`scripts/sync-access.ts` already does)
- [x] Checks: `npm run audit:check` (every model has the columns), `npm run test:audit-db` (36 checks on a real database), `npm run test:unit` (Vitest since 16 Oct 2026; config in `vitest.config.mts`, the `@/` alias works in tests)
- [x] `ActivityLog`: append-only (enforced by a trigger), field-level before/after, actor snapshot, on-behalf-of, source, request id, secrets redacted
- [ ] Reusable Timeline component: entity history tab, shop activity page, admin global audit, user "account activity" (logins, password and role changes, support access)
- [x] User columns added: `status`, `suspendedReason`, `lastLoginAt`, `locale`, `timezone`, `preferences`, `deletedAt`
- [x] Guard refuses non-ACTIVE users (also soft-deleted ones)
- [ ] Refuse non-ACTIVE users at login too, write `lastLoginAt` on login, record login events with `logActivity`

**Permission layer: what was checked (15 Oct 2026).** Same limits as before (no npm in the session):
- `lib/access` unit tests: 22 pass (catalogue, patterns, system roles, deny-wins, scopes, expiry, no escalation)
- the access-table trigger SQL (now `20261015181723_access_audit_triggers`) applied on Postgres 16 on tables shaped like the new models: 36 database checks pass, array changes (`permissions`) are logged with before/after, `providerId` lands on assignment log rows
- `lib/access/guard.ts` and `load.ts` type-check against stubs of `@/auth`, `@/lib/prisma` and the Prisma enums (the routes and `scripts/sync-access.ts` were not compiled: no generated Prisma client here)

**Passed on your machine (15 Oct 2026):** `access_control` migration, audit triggers on the two new tables (24 triggers in total), `npm run access:sync` (14 roles; SUPER_ADMIN for the admin; OWNER for the 6 verified shops), `prisma generate`, `tsc --noEmit` with the new routes, `npm run test:unit` (33 pass), `npm run test:audit-db` (36 pass).

**Still to check by hand (after copying the `withAudit` changes):** run `npx prisma generate; npx tsc --noEmit`, then make one change in the app (edit a product name as a provider, create a category as admin, change your profile name) and look at the log in pgAdmin: `SELECT "createdAt", "entityType", action, "actorName", "actorRole", source, changes FROM "ActivityLog" ORDER BY "createdAt" DESC LIMIT 10;` The row should name you, not be empty with source SYSTEM. Earlier click-through: admin (users, providers, catalogue, categories, suggestions, approve and reject a shop) and provider (products list, create, edit, delete). Then, as a quick negative test, give a test user the INVENTORY_CLERK role on a shop and confirm they can edit a product but get 403 when changing its price.

**Audit foundation: what was checked (15 Oct 2026).** The session could not install npm packages, so
this was tested against a local Postgres 16 instead:
- the migration applies on top of the 8 existing migrations, on tables that already contain rows and on an empty database
- my own comparison script (a stand-in for `prisma migrate diff`) found no differences between `schema.prisma` and the database, and fails when a mismatch is planted
- `prisma/tests/audit-foundation.sql`: 36 checks pass. `lib/audit` unit tests: 11 pass. `lib/audit/actor.ts` passes `tsc --strict`

**Not checked. Run these on your machine before relying on it:**
1. ~~`npx prisma validate`~~ passed on your machine on 15 Oct 2026
2. ~~`npx prisma migrate dev`~~ passed on your machine on 15 Oct 2026: columns from Prisma's `20261015113316_audit_foundation`, triggers from `20261015115650_audit_triggers`; trigger count in the database is 20
3. `npx prisma generate && npx tsc --noEmit` (this is the only check that covers `lib/audit/run.ts`); `generate` passed, `tsc` only complained about stale `.next/types`
4. ~~`npm run audit:check`~~, ~~`npm run test:unit`~~ (11 pass), ~~`prisma/tests/audit-foundation.sql`~~ (36 PASS, rolled back) all passed on your machine on 15 Oct 2026
5. In dev, make one real write through `withAudit` and confirm the actor appears in `ActivityLog`

**Super admin / impersonation**
- [ ] `ImpersonationSession` model + banner + auto-expiry (read-only by default; writing needs a separate permission and a reason)
- [ ] Block credential, payout and account-deletion actions while impersonating
- [ ] Every action while impersonating logs the real admin and the user acted on behalf of
- [ ] Users can see "support accessed your account" in their activity
- [ ] "View as" from a user, a shop, an order or a support ticket

## Phase 8 – Support module
- [ ] Help page: create a ticket (category, priority, subject, description, attachments); context captured automatically (page, role, browser, shop)
- [ ] Ticket thread for the requester; email notifications on replies (needs real email)
- [ ] Support inbox for agents: filters, assignment, status, priority, internal notes, canned replies
- [ ] Link a ticket to an order / product / shop; "view as requester" from the ticket (read-only impersonation)
- [ ] Shop staff can file tickets for the shop; the owner sees shop tickets
- [ ] Feature requests and recommendations board: submit, vote (one per user), comment, status (new → planned → in progress → shipped / declined / duplicate)
- [ ] Duplicate suggestions while typing; admin merge of duplicates
- [ ] Public roadmap / changelog page
- [ ] Support metrics: first response time, time to resolution, open by category
- [ ] Spam and abuse limits on submission

## Phase 9 – Fixes and production readiness

Fix first (small, and they affect data or deploys):
- [x] **Deploy:** `app/generated/prisma` is gitignored and there was no `postinstall: prisma generate` (added 17 Oct 2026; not yet tried on a real deploy); a fresh clone / Vercel build has no client
- [x] **Prisma 7 config:** `prisma7.config.ts` is picked up automatically (`prisma validate` loaded it on 15 Oct 2026). Nothing to rename
- [x] Lowercase / trim emails on register, login, forgot and reset (avoid duplicate accounts). Built 17 Oct 2026; existing accounts are cleaned with `npm run db:normalize-emails`
- [x] Price must be greater than 0 (`parsePrice` accepts 0, which would top every comparison)
- [x] **Unit changes. Decided 16 Oct 2026, built 17 Oct** (moved to “Decisions of 16 Oct 2026”, 7): linked products get `needsPriceReview = true`, drop out of comparison and ordering until the provider confirms the price, and the provider is notified and sees an alert on the dashboard
- [x] Navbar and provider sub-nav link to `/provider/orders`, which does not exist. Links removed; add them back with the orders page in R5
- [x] Page metadata still says "Create Next App"; add `error`, `not-found` and `loading` pages
- [x] Remove the stale "WORKSPACE NOTE" comment in the provider reject route (already gone)

Then:
- [ ] Real email sending (Resend or similar); reset links are only `console.log`ged
- [ ] Rate limiting on login, register, forgot / reset password
- [ ] Password reset should set `passwordChangedAt` and revoke sessions; `passwordChangedAt` is written but never read
- [ ] JWT callback does up to 3 queries + a write on every `auth()` call (15 call sites); throttle the `lastActiveAt` update
- [ ] Hash reset tokens at rest
- [x] Tests for the pure logic (`product-input`, `product-filters`, `slug`, `email-input`, `price-review`, `members`) and a CI workflow (`.github/workflows/ci.yml`: generate, `tsc`, unit tests). Catalogue input needs a database and is not covered
- [ ] Verify end to end: a newly approved provider can reach `/provider/*` without logging out (proxy reads the role from the JWT cookie)

---

## Decisions of 16 Oct 2026 (answers to the open questions)

Recorded so the design is not re-discussed. Each item says what is decided, what it means for the
data and code, and what is still open.

### 1. Several warehouses per shop, stock per warehouse
- **Data:** `Warehouse` (shop, name, address, city, governorate, latitude, longitude, `locationSource`, isDefault, isActive, archivedAt; reuses the map picker). `StockLevel` (product, warehouse, quantity, reorder point). `Product.stock` becomes the total across warehouses (kept in step by the application in the same transaction)
- **Stock movements per warehouse (decided 16 Oct 2026):** every movement is a row in the stock ledger with its warehouse (received, sold, adjusted, returned, counted, transferred in, transferred out), quantity, reason, who, when and the order it came from. A transfer is two linked rows. Each warehouse has a **movement history page** (filter by product, type, date, person) next to its current stock
- **Deleting a warehouse:** it can be **deleted only if it has never had a movement** (created by mistake). Once it has any movement it can only be **archived**, and only when its stock is 0 (transfer the rest out first). Archived warehouses keep their history, take no new stock and do not count toward the plan limit
- **One inventory view:** all products with their quantity per warehouse, filters (low stock, one warehouse), transfer and adjust from there
- **Orders:** accepting an order takes stock from a chosen warehouse (default: the one with enough stock, nearest to the buyer); cancelling puts it back into the same one
- **Phase 4:** distance and travel cost use the nearest warehouse that has the item
- **Migration:** every existing shop gets a default warehouse (from its profile address and pin) holding its current `Product.stock`
- **Limits:** the number of active warehouses is a plan limit (decision 4)
- Who may transfer and adjust: owner and manager by default (`inventory.location.manage`, `inventory.adjustment.create`); a warehouse-staff role can come with the team work

### 2. Custom taxes per shop: the provider enters the price without tax (HT), the customer sees it with tax (TTC)
- **Decided 16 Oct 2026:** the provider types the price **before tax (HT)**, chooses which of his taxes apply to the product, and the client sees the **tax-inclusive price (TTC)**. This **changes what `Product.price` means**: it becomes the HT base price
- **Taxes (`TaxRate`, per shop):** name, kind **percentage or fixed amount per unit** (both needed), value, `appliesOn` and a sort order, isActive, optional validFrom / validTo. A product can have **several taxes** (`ProductTax`). Permission `pricing.tax.manage` exists
- **Pre and post calculation:** each tax says whether it applies **on the base price** (pre) or **on the base plus the taxes calculated before it** (post). Taxes are applied in the shop's sort order, so a percentage tax can sit on top of an earlier tax or of a fixed amount
- **Worked example (placeholder rates):** base 100.000; tax A 1% on the base = 1.000; tax B 19% on the running total (101.000) = 19.190; fixed 0.500 per unit; TTC = 100.000 + 1.000 + 19.190 + 0.500 = 120.690
- **Rounding:** the dinar has 3 decimals (millimes, matching `Decimal(12,3)`). Each tax line is rounded to 3 decimals, half up, and the TTC is the sum of the rounded lines, so the lines always add up to the total
- **One pure function** `computePrice(base, taxes)` returns the lines and the TTC; it is the only place that does this arithmetic, with unit tests
- **Stored TTC:** `Product.priceTtc` is kept in step (same transaction) whenever the base price, the product's taxes or a tax's value change, so search, sorting and comparison read one indexed column. Changing a tax's rate recomputes that shop's affected products in one transaction
- **Existing products:** the current price is treated as HT with no taxes, so TTC equals today's price until the provider adds taxes; nothing changes for buyers by surprise
- **Comparison and display:** always TTC. The provider's own pages show HT, the taxes and the TTC
- **Orders:** an order item snapshots the HT price, every tax line and the TTC, so a later rate change never rewrites history
- **Reports:** tax collected per shop, per tax and per period, from the order item lines; admin sees totals per shop
- **Why per shop:** rates change from year to year and differ by product type; providers manage their own, no developer needed. Admin may offer common presets to start from
- The stamp duty is charged per invoice, not per product, so it belongs to invoicing for business clients (backlog C). The Tunisian rates, which taxes stack on which, and the invoice rules must be confirmed with an accountant before presets are written
- Open: whether a shop may mark a product as tax-exempt explicitly (no taxes selected means no tax); whether the same tax may apply differently by unit

### 3. Image storage: deferred
Neither candidate is free with good coverage for Tunisia. Nothing is built; products show a placeholder. Revisit once the number of shops justifies a paid service. When revisited: compare Vercel Blob, Cloudinary and an S3-compatible bucket on price, delivery speed from Tunisia and image resizing.

### 4. Revenue: free tier and subscriptions with limits
- **Decided 16 Oct 2026:** a **free plan** with limits and **paid plans** that raise them and unlock more features, so the subscription is worth buying. Commission on completed orders stays a possible later add-on
- **Data:** `Plan` (key, name, price, limits and feature flags), `Subscription` (shop, plan, status, period, trial). A shop with no subscription is on the free plan
- **Starting limits (placeholders to tune; prices are the owner's choice):**

| Limit | Free | Pro | Business |
|---|---|---|---|
| Products | 50 | 500 | unlimited |
| Warehouses | 1 | 3 | 10 |
| Team seats | 1 | 3 | 10 |
| Custom taxes | 3 | 10 | unlimited |
| Reports and exports | basic | full | full + CSV import |
| Shops owned by one person | 1 | 3 | 10 |

- **What is limited:** things that grow with the size of the business. **Never limited:** security and safety (2FA, the audit log, notifications)
- **One helper** `checkLimit(shop, "warehouses")` is called by every feature that has a limit, with generous defaults until plans exist
- **Feature flags** for plan-only features (advanced reports, bulk import, API access, priority placement)
- **Trial:** 14 days of Pro for each newly approved shop
- **Payment:** the payment method is not chosen, so at first an admin marks a subscription as paid by hand. No payment gateway is needed to start
- **Over the limit after a downgrade:** nothing is deleted or hidden. The shop cannot create new items beyond the limit, and a banner explains why. Team seats get a 30-day grace period, after which the extra members become read-only
- Billing (invoices, collections) stays in backlog I and needs the accountant's input
- Open: the real limits and prices per plan

### 5. One person, several shops: shop switcher and active shop
- **Cookie:** `activeProviderId`, set by `POST /api/me/active-shop` after checking the person has a live assignment in that shop. `GET /api/me/shops` lists their shops for the switcher in the navbar
- **Switcher (decided 16 Oct 2026):** always shown for a person with a shop, **even with one shop**, with a **"Create shop" button at the bottom**. It lists their approved shops (name, city, role) and any shop still waiting for approval (shown disabled, with "pending")
- **Create shop:** opens the application form (the same shared form as `/become-provider`) for an additional shop. It goes through the same admin approval, and approval makes the creator OWNER of that shop. The number of shops one person may own is a plan limit (decision 4)
- **Data change this needs:** `Provider.userId` is `@unique` today, which allows one shop per person. It must become a plain indexed column ("the person who applied"), and the code that looks a shop up by `userId` (`/api/provider/apply`, `requireProvider()`, the pending lookup in `requireShop()`) must handle several rows. Ownership itself already lives in `AccessAssignment`
- **Guards:** `requireShop()` reads the cookie, and **never trusts it**: the id must be in the person's live shop assignments, otherwise it falls back to the first shop (or 403 when the request names a shop explicitly). `requireProvider()` for pages does the same
- **proxy.ts:** `/provider` is allowed for anyone with an active shop assignment, no longer by `User.role` (the same change as the team item in 3d); a person can also act as a client
- **Notifications and activity:** shop-scoped events go to the shop's members; the activity log already carries `providerId`
- **Membership rules (decided 16 Oct 2026):** one person can belong to many shops, and one shop has many people (employees). **Every shop must always have an employer: at least one active OWNER.** The employer is the owner; employees hold the other shop roles
  - The last active OWNER cannot be removed, suspended, downgraded or leave; ownership is transferred first (step-up check, activity-log entry, notification to both people)
  - A person can be an employee in one shop and the owner of another; each shop's access is computed from that shop's assignment only
  - Ownership is read from `AccessAssignment` (OWNER role), never from `Provider.userId`, which only records who applied
  - If an owner's account is closed or deleted while they are the last owner, the shop is suspended and an admin is notified rather than left without an employer
- Open: whether the last active shop is remembered across devices (cookie only for now)

### 6. 2FA
Mandatory for SUPER_ADMIN and for any staff who can impersonate; optional for providers and clients. Authenticator app (TOTP) with recovery codes first. The step-up check (recent 2FA or password) guards role changes, ownership transfer, impersonation and data export. Open: SMS / WhatsApp codes.

### 7. Catalogue unit change must not leave a stale price
- **Trigger:** an admin changes a catalogue item's unit, or approves a suggestion that merges into an item with a different unit
- **Effect on every linked product:** `needsPriceReview = true` plus a short `priceReviewReason` (for example "Unit changed from piece to box of 10"). The product keeps its own on/off choice (`isActive` is not touched), but it is **left out of comparison and cannot be ordered** until the provider confirms
- **Tell the provider:** a notification to the shop members who can edit prices, and an alert on the provider dashboard: "The catalogue item [X] changed unit from Piece to Box" with a link to the products waiting for review (filter on the products list)
- **Clearing it:** the provider saves a price (or chooses “keep this price”) on the product; this needs `product.price.edit`, so only owner and manager can clear it. The change is in the activity log
- **Decided 16 Oct 2026:** before the change is saved, the admin sees a preview and must confirm: "This will flag N products in M shops for a price review"
- With taxes (decision 2) the price to confirm is the HT base price; the TTC is recomputed from it

### 8. A Business sits above the shops (decided 18 Oct 2026, option B)
- **Words:** *Business* = the trader or company (one legal entity). *Shop* = one outlet or location of a business (the `Provider` table today, "shop" in the interface). *Person* = `User`. A person can belong to several businesses and to several shops
- **Business holds:** name, legal name, tax number (matricule fiscal), trade registry number (RNE), billing contact (email, phone, address), its owners, and later its **plan and subscription** (R2d) and invoicing details (R7). Plan limits such as "shops owned" count per business
- **Shop holds:** address, map pin, phone, WhatsApp, description, hours, products, warehouses, orders. Customers compare and order from **shops**
- **People, two levels:** an assignment is either `BUSINESS` scope (applies to **every shop** of that business: the owner, an accountant for all outlets) or `SHOP` scope (one shop: a branch manager, a clerk). A business-level assignment inherits into each shop; a shop-level one never reaches another shop or the business
- **Owner rule:** a business always has at least one live business-level owner (the rule from R2a now counts business owners). Shop-level OWNER stays available for a franchise-style branch owner
- **Pages:** *Business* page for business owners (legal and billing details) and *Shop profile* for the shop in front of you. The account page `/profile` stays about the person
- **Applying:** a first application creates the business and the shop together. "Create shop" adds a shop to a business you own (or starts a separate business if you choose that). Approval makes the applicant business owner
- **Existing data:** each existing shop gets its own business (named like the shop) and its owner becomes business owner. Done by a script, in three steps (expand, backfill, contract): `Provider.businessId` is nullable until the backfill has run, then a later migration makes it required
- **Not yet:** business-level team page and invites (R2c), plan on the business (R2d), tax and invoice use of the legal fields (R3, R7)

---

## Catalogue & categories (decided)

| Asset | Owner | Provider can… |
|-------|--------|----------------|
| **Category** | Admin | Not create; may assign an existing category on free-form products |
| **CatalogItem** | Admin | Link a product to an existing item; list free-form if missing |
| **CatalogSuggestion** | Provider submits → admin reviews | Promote a free-form listing into the shared catalogue (or merge) |
| **Product** | Provider | Full control of own listings (price, stock, images, active) |

---

## Multi-provider orders (design target)

```
Order (client, overall status derived from the slices)
├── OrderProvider (provider A) — status, fulfillment mode, subtotal
│   └── OrderItem[]
├── OrderProvider (provider B)
│   └── OrderItem[]
└── …
```

- Estimate = pre-commit cart (same shape; no stock hold until the provider accepts).
- On confirm: create Order + OrderProviders + OrderItems; snapshot price / name / unit.
- Provider dashboard only shows their OrderProvider rows.
- Client sees one order with per-provider progress.
- Every status change is an event (who, when, from → to), shown as a timeline to the client.

---

## Backlog ideas (added 15 Oct 2026, not started)
Collected from a brainstorm. Nothing here is scheduled or designed yet; items that overlap an existing
phase point to it. Each group ends with the questions to settle before building it.

### A. Account area and security (every role)
Today the account area is only a profile. Target: Profile, Security, Sessions, Connected accounts,
Notifications, Activity, Help & support.
- [ ] **Security page:** two-factor authentication (authenticator app + recovery codes), change password, idle / absolute session timeout setting, "sign out everywhere"
- [ ] **Sessions:** list devices (the `LoginSession` table already exists), revoke one or all
- [ ] **Connected accounts:** link / unlink sign-in providers (the NextAuth `Account` table exists); never allow unlinking the last way to sign in
- [ ] **Activity:** the person's own history (logins, password and role changes, support access) from `ActivityLog`
- [ ] **Notification settings:** per event type and channel (email now, WhatsApp / SMS later); stored per user
- [ ] **Step-up check** (recent password / 2FA) before sensitive actions: role changes, ownership transfer, impersonation, data export (already listed in Phase 7)
- [ ] **Person profile** (shop staff and business-client staff need their own details): name, photo, phone, job title, language, timezone, and "where I work" (shops / organisations with my role)
- [ ] **Admin detail pages** so support and admins can read an account without impersonating it: one for a client, one for a provider (shop details, team, listings, orders, tickets, activity timeline). Read-only first; uses the audit timeline and the `user.account.view` / `shop.provider.view` permissions
- Questions: SMS / WhatsApp codes besides the authenticator app. **Decided 16 Oct 2026:** 2FA is mandatory for SUPER_ADMIN and impersonating staff, optional for providers and clients

### B. Inventory management (beyond a stock number)
Today a product has a single `stock` integer. The permission keys `inventory.location.manage` and
`inventory.adjustment.create` already exist.
- [ ] **Stock ledger** (append-only movement book): every change is a row (received, sold, adjusted, returned, counted, transferred) with quantity, reason, who, when and the order it came from; `stock` becomes the running total. Gives a history per product and makes order accept / cancel restore stock correctly (see 3c)
- [ ] **Reorder queue:** low-stock and out-of-stock list with a reorder point per product, status (to order / ordered / received), optional supplier and expected date; feeds the provider dashboard and notifications
- [ ] **Stock adjustments and counts:** manual correction with a required reason; stocktake mode
- [ ] **Warehouses. Decided 16 Oct 2026:** every shop can have several; stock is kept per warehouse and managed from one inventory view (see “Decisions of 16 Oct 2026”, 1). Uses `inventory.location.manage`
- [ ] Permission checks use the existing keys; `product.stock.edit` stays the quick edit, the ledger records it
- Questions: "ledger book" is read here as the stock movement ledger. If you also meant an accounting ledger, that belongs to billing (group I). Locations are decided: several warehouses from the start

### C. Two kinds of client: personal and business
- [ ] **Client type:** PERSONAL or BUSINESS
- [ ] **Business client = an organisation** with several accounts, each with a role and permissions (same assignment model as shop staff, with a new organisation scope), a client team page, and an owner
- [ ] **Legal and accounting details:** legal name, tax identification number, address, billing contact
- [ ] **Invoices:** a legal invoice per order (or per provider slice) with sequential numbering, tax lines and a PDF; business clients can download and filter them; accounting export
- [ ] Permission keys for the organisation scope (members, roles, orders, invoices, spending limits / approvals later)
- Questions: Tunisian invoicing rules (tax ID format, VAT lines, stamp duty, who issues the invoice: the provider, since they sell, or the marketplace) must be checked with an accountant before design. Does a person keep one login and join organisations, or have separate accounts?

### D. Team pages (provider and business client)
- [ ] **Provider team page and invites:** already planned in 3d (data model and guard are done)
- [ ] **Client team page:** same screens for business clients (invite, change role, suspend / remove, protect the last owner)
- [ ] One shared team component driven by the scope, not two copies

### E. Analytics and reports
Permission keys `insight.*` (shop) and `analytics.*` (platform) already exist.
- [ ] **Provider:** sales over time, top products, order funnel (requested → accepted → completed), stock health, price position against the market, exports
- [ ] **Admin:** gross order value, sign-ups, active shops and clients, catalogue health (suggestions waiting, items without offers), support metrics, shop leaderboard, exports
- Needs orders first (Phase 3c / 4); views and price-position data can start earlier (see 3e)

### F. Promotions and reviews
- [ ] **Promotions per product:** percentage or fixed price, start and end dates, optional minimum quantity; shown in comparison and estimates (`pricing.promotion.manage`)
- [ ] **Reviews and ratings:** only from clients with a completed order from that shop; shop can reply (`review.rating.reply`); admin moderation (reports, hide) with an audit trail
- Questions: do promotions change the compared price or show as a badge only; are reviews about the shop, the product, or both

### G. Help and support page
- [ ] A "Help & support" entry in every account area, wired to the ticket and feature-request flows already planned in **Phase 8**

### H. Admin project and deal board
- [ ] **Kanban board** for the admin panel: boards, columns, cards, assignee, due date, labels, comments, drag to move
- [ ] **Two board types:** PROJECT (product and operations tasks) and DEAL (sales pipeline for onboarding shops and business clients: lead → contacted → demo → onboarded / lost, with value, contact and next step)
- [ ] A deal can link to a shop application, a provider or a business client, and convert into one
- [ ] New permission keys (`board.*`, `deal.*`) and role mappings; every move is in the audit log
- Questions: a built-in board versus an external tool; one board or one per team

### I. Admin billing and revenue (needs decisions first)
The marketplace earns money from providers, but the mechanism is not chosen. Payments are mostly cash on
delivery or pickup, so the money rarely passes through Bayna and a commission cannot simply be deducted
from a payout.
- [ ] **Revenue model. Decided 16 Oct 2026 (direction):** a free tier plus paid subscriptions with limits, combined with features that make the plans worth paying for (see “Decisions of 16 Oct 2026”, 4). Commission on orders stays a later option
- [ ] **Plans and limits:** plan table, per-shop plan, limit checks (products, team seats), upgrade and downgrade
- [ ] **Commission statements and invoices to providers:** monthly statement from completed orders, invoice with legal numbering, payment status and due date
- [ ] **Collections:** record payments (bank transfer, card or local payment methods once chosen), overdue reminders, restrict or suspend a shop after a grace period (ties to shop states in 3e)
- [ ] **Admin billing page:** revenue, receivables, overdue shops, commission by shop and category, exports; the finance role and keys (`finance.commission.*`, `finance.payout.*`) exist
- [ ] **Financial ledger:** an append-only record of money events behind the statements
- Questions to answer first: commission rate and whether it varies by category; free tier and trial; how a shop pays (transfer, card, local wallet); who issues the commercial invoice for an order; legal and tax treatment in Tunisia (needs an accountant)

---

## Phase 7b – Notifications (built and verified 16 Oct 2026)
A bell dropdown in the header next to the user menu, so people learn that something happened without
refreshing. Built once, before orders and support, so every later feature calls one helper.
- [x] `Notification` table: recipient user, type, title, body, link, `readAt`, `createdAt`; stamped by `audit_attach('Notification', '', '', false)` (no log rows: the causing event is already logged)
- [x] `notify(tx, userId, {...})` helper that runs inside the same `withAudit` transaction as the event, so a notification is never lost or sent for a rolled-back change
- [x] `GET /api/notifications` (list + unread count), `POST` to mark one or all as read; everyone reads only their own, so no new permission key
- [x] Header bell with unread badge and dropdown; poll every 30 to 60 seconds (real-time push later)
- [x] First events: admin marks a shop's changes reviewed (`/api/admin/providers/[id]/reviewed`), application approved, application rejected
- [ ] Later events: **low-stock and out-of-stock alerts** (see below), products flagged for price review, order status changes, support ticket replies, account and security alerts (backlog A)
- [ ] **Stock alerts through notifications:** when a product's quantity in a warehouse falls to or below its reorder point (and when it reaches 0), notify the members who hold `product.stock.edit`. Only on the crossing, not on every save, so there is no flood; the alert clears when stock is restored above the point. Links to the product. Needs the reorder point from the inventory work (backlog B)
- [ ] Preferences per type and channel (in-app, email) once emails exist (Phase 9)
- Questions: how long to keep read notifications; whether staff-targeted notifications go to a role or to named people

---

## Next up (execution order)

Regrouped on 16 Oct 2026 into seven releases. Work that touches the same tables, screens or helper is
bundled so it shares one migration, one design decision and one round of testing. Each release ends
with a gate (tests plus a click-through checklist, as for the profile) before the next starts. Inside a
release the steps are in the order to build them. Reorder releases freely, but check **Needs** first.

**Done:** audit columns and `ActivityLog`, permission layer, `withAudit` everywhere, provider profile
(map pin, review flag, edit / withdraw application), notifications (bell, `notify()`, approved /
rejected / reviewed).

### R1. Clean base (built 17 Oct 2026, being verified)
Everything here touches products, the catalogue or configuration, and none of it needs a new concept.
- **Fix list (Phase 9, "fix first"):** `postinstall: prisma generate`, price must be above 0, lowercase and trim emails, dead `/provider/orders` link, page metadata, `error` / `not-found` / `loading` pages, stale comment in the reject route
- **One product migration** for the four columns that three items need: `needsPriceReview` + `priceReviewReason` (unit-change guard, decision 7), `deletedAt` (soft delete) and `priceUpdatedAt` ("price last confirmed")
- **Unit-change guard** (decision 7): admin preview and confirm, flag linked products, notify, dashboard alert, leave flagged products out of comparison
- **Product soft delete** with a Trash page and Restore, then **inline price and stock edit** on the products table (price edit stays owner and manager only)
- **Interface basics** (`components/ui`): `useConfirm()` replaces every browser `confirm()` / `alert()` with a styled dialog; `useToast()` reports what just happened (saved, removed, approved) with an optional button such as Undo. Rule for new code: ask with `useConfirm`, report with `useToast`, never `window.confirm`. Wired so far: products (delete, undo, restore, inline edit, save), price confirm, admin providers (approve, reject, reviewed), admin catalogue (save, archive, unit change), catalogue requests, withdraw application. Not yet: account profile and password pages, category reorder
- **Tests for the pure logic** (`product-input`, `product-filters`, slug and catalogue input) and a CI workflow; a first deploy to a staging environment so deploy problems show up early
- **Needs:** nothing. **Gate:** `test:unit`, `tsc`, a flagged product disappears from comparison data and reappears after the price is confirmed

### R2. Shops, people and plans
One theme: who belongs to a shop and what a shop may do. All of it rests on `AccessAssignment`, the guard and the same navbar, so it is one design.
**Order of work (agreed 18 Oct 2026, updated after decision 8):** R2a (done), **B1 Business level**, then R2c team and invites (scope-aware: business or shop), then R2d plans and user management (plan on the business), then R2b real email and hardening (last, it needs a service chosen). Invites before email are **copy-link** invites.

**B1, Business level (built 18 Oct 2026, being verified)**
- [x] Schema: `Business`, `Provider.businessId` (nullable for now), `AccessAssignment.businessId`, `AccessScope.BUSINESS`; audit line for `Business` (added by hand to the migration)
- [x] Permission model: business keys (`business.profile`, `business.shop`, `business.team`), BUSINESS roles (Business owner, Business accountant), inheritance into shops in `lib/access/evaluate.ts` (a shop check passes the shop's `businessId`), `lib/access/reach.ts`, tested
- [x] Guard and loaders follow it: `requireShop` (inherited shops), new `requireBusiness`, shop switcher (names the business when you work in several), notification recipients include business-level members, last-owner rule can run on a business (`assertKeepsAnOwner`)
- [x] Apply creates the business with the shop; "Create shop" adds to a business you own (or a separate one, `lib/business-choice.ts`); approve makes the applicant business owner; reject and withdraw remove an empty business
- [x] `scripts/backfill-businesses.ts` (`npm run db:backfill-businesses`, `--dry` first) and `npm run access:sync` (creates the business roles) for existing data
- [x] **Business** page (`/provider/business`, server-rendered so it always shows the business of the shop in front of you) with legal and billing details, saved through `/api/provider/business`; legal fields only for the business owner
- [ ] **Contract step:** after the backfill, a later migration makes `Provider.businessId` required (and `prisma/tests/audit-foundation.sql` must then insert a Business first)
- [x] The "Create shop" form asks which business the shop belongs to ("Add to X" or "A separate business"); a first application has no choice to make
- [ ] Team page (business or shop level) is R2c: it must call `assertKeepsAnOwner` and use `business.team.*` / `team.member.*`

**R2a, shops per person (built 18 Oct 2026, being verified)**
- [x] `Provider.userId` is no longer unique: one person can apply for and own several shops (`User.providers`). Ownership and roles stay in `AccessAssignment`
- [x] Active shop: `bayna_shop` cookie holds the choice but is never trusted; `pickActiveShop()` checks it against live assignments on every request (guard, pages, API). No valid hint = first shop by id
- [x] `GET /api/me/shops` (shops + waiting applications + active) and `POST /api/me/active-shop` (refuses a shop the person does not work in)
- [x] Shop switcher in the provider sub-navigation, always shown, **Create shop** at the bottom; waiting applications are listed but disabled. Switching goes back to the dashboard
- [x] **Create shop**: `/become-provider` now works for existing providers (one waiting application at a time); the apply routes look at the waiting application, not "the" provider
- [x] Rejecting an application only sets the person back to CLIENT if they run no other shop; approved shops can no longer be rejected or re-approved by mistake
- [x] **Last-owner rule** (`lib/access/owners.ts`): `checkOwnerRule` / `assertKeepsAnOwner`, tested. Nothing calls it yet because there are no team routes; R2c (remove, suspend, change role) and R2d (close account) must call it
- [ ] `proxy.ts` is unchanged on purpose: it runs without database access, so it still gates by role. Access to a shop is checked by the guard, `requireProvider()` and the API routes
- [ ] Closing the last owner's account suspends the shop and notifies admin (R2d, user management)
- **Shop switcher, active shop cookie, "Create shop"**, drop the unique on `Provider.userId`, gate `/provider` by assignment in `proxy.ts` (decision 5)
- **Membership rules:** the last owner is protected, ownership transfer with a step-up check (decision 5)
- **Real email sending** (Resend or similar), then everything that needs it in the same release: invite links, password reset links, an email channel for notifications
- **Hardening that belongs with email and sign-in:** rate limiting on login, register and reset; hash reset tokens; reset sets `passwordChangedAt` and revokes sessions; throttle the `lastActiveAt` write in the JWT callback
- **Team page:** invite, change role, suspend / remove; the shop activity page for owner and manager; "last changed by" on product pages
- **Person profile** with "where I work" (shops and roles), which the switcher also feeds
- **Plans skeleton** (decision 4): `Plan`, `Subscription`, `checkLimit()`; enforce shops owned and team seats now; admin marks a plan as paid by hand
- **Shop states and user management** (3e, Phase 5): suspended and temporarily closed shops, suspend / reinstate users, force password reset, revoke sessions. Replaces the risky reject-a-verified-provider path
- **Needs:** R1. **Gate:** invite someone to two shops, switch between them, try to remove the last owner (must fail), receive a real email

### R3. Stock and prices (listings)
Two tracks that both change the product form, the products table and what an order will later snapshot. Do them one after the other, inventory first.
- **3A Inventory** (decision 1, backlog B): warehouses, `StockLevel`, the movement ledger with a history page per warehouse, adjustments and stocktake, reorder point and reorder queue, the one inventory view with transfers, migration of existing stock to a default warehouse
- **Stock alerts** (notifications): low and out of stock, only on the crossing; the provider dashboard shows low stock and products waiting for a price review
- **3B Taxes and pricing** (decision 2): `TaxRate` (percentage or fixed, pre or post), `ProductTax`, `computePrice()` with tests, stored `priceTtc`, HT entry and TTC display; **price history**, **quantity price tiers** and **delivery fee**
- **Then:** bulk edit and CSV import / export (a Pro-plan feature, checked with `checkLimit` / a feature flag), and warehouse and product limits enforced by plans
- **Needs:** R1 (soft delete, `priceUpdatedAt`) and R2 (plans skeleton, active shop). **Gate:** a stock transfer shows in both warehouses' histories, a rate change recomputes TTC, an alert fires once and clears when stock is restored

### R4. Marketplace for clients (public side)
Everything a buyer sees before ordering. It reads stock (nearest warehouse) and TTC prices, so it comes after R3.
- **Search and comparison** per catalogue item: TTC price, stock, minimum order, city, price age; flagged products excluded
- **Client location** (city picker) and **distance plus travel cost** from the nearest warehouse that has the item
- **Public shop page and shop map**, reusing `LocationMap`; the profile extras that feed it: opening hours, delivery / pickup / COD options, open / closed / vacation status
- **Client dashboard** (replaces the placeholder)
- **i18n (FR + AR)** for these public pages first, showing `nameAr`; admin and provider screens follow later
- **Hardware catalogue expansion** so there is something to compare beyond construction and auto parts
- **Needs:** R3. **Gate:** compare three shops for one item from a chosen city and see the cheapest TTC price and the distance

### R5. Orders
The core of the marketplace. Stock, taxes, warehouses and notifications are all in place, so the order schema is built once.
- **Order schema:** `Order`, `OrderProvider`, `OrderItem` with snapshots of HT price, every tax line, TTC, unit, name and warehouse
- **Estimate (cart / quote), checkout, client order history** with per-provider progress
- **Provider inbox and status machine** (new, accepted, preparing, ready, completed, cancelled), COD and pickup flows; accept takes stock from a warehouse, cancel puts it back (ledger rows)
- **Order notifications** to client and provider, status history visible to the client, assign an order to an employee
- **Admin order oversight and disputes**
- **Needs:** R3, R4. **Gate:** one order split across two shops, accepted in one and cancelled in the other, stock and notifications correct, tax lines in the snapshot

*A possible soft launch is here, after R5 plus the minimal help contact from R6. The hardening in R2 must be done before that.*

### R6. Trust, security and support
These share the step-up check and the rule "who may see another person's account", so they are built together.
- **2FA (TOTP) and the step-up check** (decision 6): mandatory for SUPER_ADMIN and impersonating staff, optional for others; recovery codes
- **Security page:** change password, sessions list and revoke, "sign out everywhere", idle timeout, connected accounts (Google / Facebook OAuth, never unlink the last way in)
- **Account pages:** the person's own activity, notification settings per type and channel, the rest of the person profile
- **Platform staff accounts and roles**, **impersonation** ("view as", real admin recorded as actor), **admin detail pages** for a client and a provider, **global audit view**
- **Support module** (Phase 8): help page and tickets, support inbox, feature requests board with votes, public roadmap, support metrics
- **Needs:** R2 (email, hardening). Start the 2FA part earlier if staff accounts are needed sooner. **Gate:** an agent opens a ticket, starts a read-only "view as" only after 2FA, and the session shows in the audit log

### R7. Money and insight (after real orders exist)
Needs real data and, for billing, an accountant.
- **Billing and collections** (backlog I): plan payments, invoices, overdue handling, finance pages; commission stays an optional add-on
- **Analytics and reports** (backlog E) including the **tax collected** report from order item lines, and **provider insights** (views, position against the cheapest shop)
- **Promotions and reviews** (backlog F); reviews need completed orders
- **Business clients and their team** (backlog C and D): invoices with Tunisian rules (accountant needed), company details, client team page
- **Admin project and deal board** (backlog H)
- **Needs:** R5. **Gate:** reports reconcile with the order snapshots

### Deferred on purpose
Product images (no storage service chosen, decision 3); a logo needs images, so it waits too. Commission on orders. Catalogue category archive rules and the seed re-run fix can be picked up inside R1 or R4 when convenient.

---|---|---|---|
| done | Audit columns + `ActivityLog`, permission layer, `withAudit` everywhere | | Every later action records who did it |
| done | Provider profile (3a): map pin, review flag, edit / withdraw application | | |
| done | Notifications (7b): bell, `notify()`, approved / rejected / reviewed | | One helper for every later alert |
| 1 | **Quick fixes (Phase 9):** `postinstall: prisma generate`, price must be above 0, lowercase and trim emails, dead `/provider/orders` link, page metadata, `error` / `not-found` / `loading` pages | | Small, no design questions, removes known traps |
| 2 | **Catalogue unit-change guard** (decision 7): `needsPriceReview`, notification, dashboard alert, left out of comparison | notifications | Small schema change, first real use of notifications, and it closes a correctness hole before prices matter |
| 3 | **Product soft delete + inline price / stock edit + `priceUpdatedAt`** (3b) | | Orders must never point at a deleted product |
| 4 | **Shop switcher, active shop and create shop** (decision 5): cookie, guard change, `proxy.ts` gating by assignment, `GET /api/me/shops`, drop the unique on `Provider.userId`, "Create shop" in the switcher | | One guard change that every provider page and route inherits; do it before more provider pages exist |
| 5 | **Warehouses, per-warehouse stock, movement ledger and history page, reorder point** (decision 1, backlog B) | 3 | Stock structure must exist before orders decrement it; includes the migration of current stock to a default warehouse |
| 6 | **Stock alerts through notifications** (low and out of stock) | 5 | Needs the reorder point and the stock levels |
| 7 | **Custom taxes** (decision 2): HT price entry, `TaxRate` (percentage or fixed, pre or post), `ProductTax`, `computePrice()`, stored `priceTtc`, TTC display | | Order items snapshot taxes, so taxes come before orders |
| 8 | **Plans and limits skeleton** (decision 4): `Plan`, `Subscription`, `checkLimit()` with generous free defaults; call it from warehouses, products and team seats | 5, 7 | The helper must exist before team seats and more limit-bearing features are added |
| 9 | **Client side (Phase 4):** search, comparison (tax-inclusive price, nearest warehouse), distance and travel cost, public shop page and shop map | 5, 7 | Needs warehouses (nearest stock) and taxes (fair price) |
| 10 | **Order schema, then provider inbox** (3c): snapshots of price, unit, tax breakdown and warehouse; accept decrements stock, cancel restores it; order notifications | 5, 7, 9 | The marketplace core |
| 11 | **2FA (TOTP)**, mandatory for SUPER_ADMIN and impersonating staff; step-up check | | Must be in place before impersonation |
| 12 | **Support module and impersonation** (Phase 8) | 11 | Tickets, feature requests, "view as" with the real admin as actor |
| 13 | **Real email sending** (Phase 9), then **team UI** (3d): invites, roles, last-owner protection | 4, 8 | Invites need email; seats are a plan limit |
| 14 | Account and security pages, person and admin profile pages (backlog A) | 11 | Uses 2FA and sessions |
| 15 | Billing and collections (backlog I), analytics and tax reports (backlog E), promotions and reviews (F), help page (G), admin board (H), business clients and invoices (C) | 10 | After orders exist |
| later | **Images** (storage not chosen), Google / Facebook OAuth, i18n (FR + AR), expanding the catalogue beyond construction materials and auto parts | | Deferred on purpose |

---

## Notes

- **Product** = provider’s offer (always has `providerId`)
- **CatalogItem** = shared identity for comparison (optional on Product)
- A niche item with no `catalogItemId` still sells and can be ordered; it won’t appear in cross-provider comparison views
- Product has unique `(providerId, catalogItemId)`: a provider lists a catalogue item at most once
- Linked products inherit unit and category from the CatalogItem (not editable), keeping prices comparable
- Rejected catalogue suggestions leave the custom product as-is
- Catalogue governance: categories are admin-only; providers add a custom product and optionally suggest it; an admin approves it (new item or merged into an existing one), which links the product and makes it comparable
- Each employee has their own login, so history is attributed to a person, never to the shop
- Admin impersonation records the real admin as the actor; it never attributes an admin's action to the user
- Open questions: can staff change prices (default: owner and manager only); should users be told when support accesses their account (recommended: yes). “Can one person work for several shops” is decided: yes
