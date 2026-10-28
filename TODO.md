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
- [x] Team page: invite, change role, suspend / remove; protect the last owner (built 18 Oct 2026, R2c). Still open: removing a member does not revoke their sessions yet (R6, sessions)
- [x] Activity page for owner / manager (`/provider/activity`, filter: everything / products / shop profile / team) + "last changed by" on the product edit page (R2c). Open: filter by member, order pages, business-level events (they carry no shop id, so the shop feed does not show them yet)
- [x] **Decided 16 Oct 2026:** one person can work for several shops. Shop switcher in the navbar, `activeProviderId` in a cookie, guards check it against the person's live assignments (see “Decisions of 16 Oct 2026”, 5). Not built yet

### 3e – Shop lifecycle & insights
- [x] Product status: `ProductStatus` (DRAFT, ACTIVE, HIDDEN, BLOCKED) replaces `isActive`; the platform team blocks and unblocks through `/api/admin/products/[id]/block|unblock` (no admin screen yet)
- [ ] Business status (ACTIVE, SUSPENDED, CLOSED): a suspended business stops all its shops; touches the access model, so design it before coding
- [ ] Order / request status when orders exist: REQUESTED, QUOTED, ACCEPTED, FULFILLED, CANCELLED, EXPIRED, DISPUTED; status per shop answer, a history table, allowed moves in a pure helper with tests
- [x] Shop status: `ShopStatus` (DRAFT, PENDING, ACTIVE, SUSPENDED, CLOSED) replaces `isVerified`; owners send for approval / close / reopen from the Business shops list, the platform team approves / suspends / reinstates (`lib/shop-status.ts`)
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
- [x] Reject API only removes a shop that is still waiting for approval (PENDING or DRAFT); an active shop is suspended instead (25 Oct 2026)
- [ ] Suggestion approval: create the catalogue item inside the same transaction and re-check `PENDING` inside it (concurrent approvals)
- [x] User management (25 Oct 2026, first half of R2d): admin Users page is a list with search, role and status filters, Show more and a "..." menu per row: **Suspend** (needs a reason, ends every session), **Reinstate**, **Sign out everywhere**, **Force password reset** (clears the password, ends every session, returns a one-time link valid 24 hours; no email yet). Rules in `lib/user-status.ts` (nobody acts on their own account); routes `/api/admin/users/[id]/suspend|reinstate|revoke-sessions|reset-link`; a suspended account cannot sign in and is signed out on its next request (`auth.ts`); a completed password reset now sets `passwordChangedAt` and ends old sessions. No schema change. Still open: BANNED and PENDING_DELETION have no actions, closing the last owner's account must suspend the shop and notify admin, a user detail page with `User.publicId`. Full list of what is left on accounts: see "Next steps of 26 Oct 2026" under R2
- [ ] **Platform staff accounts and roles (see Phase 7). Needed before the Support module.** Today the only way to make an admin or a support agent is by hand in the database or the seed: the team invite rules reject the PLATFORM scope on purpose (`lib/access/team-rules.ts`, `parseInviteInput`). Plan: an admin page "Staff" to invite or add people by email and give them a platform role (Super admin, Admin, Support agent, Catalogue manager), change or remove a role, with the last-owner rule (`OWNERSHIP_KEY`) and `access.*` permissions guarding it; reuse `AccessInvite` with scope PLATFORM and the same copy-link accept flow; platform roles editable like shop roles (see the catalogue regroup). Step-up and mandatory 2FA for Super admin come with it (Phase 7)
- [ ] Order oversight / disputes
- [ ] Global audit view
- [ ] **Public ids for people and clearer names (idea of 25 Oct 2026, do it with the admin dashboard).** When admins and users are managed from the admin area, their pages need an opaque id in the URL too: add `User.publicId` (opaque, unique, `@default(cuid())`), so URLs such as `/admin/users/[publicId]` never show the database id and admin accounts are not guessable. At the same time give the two existing ones distinct names so code and URLs stay readable: `Shop.publicId` becomes `shopPublicId` and `Business.publicId` becomes `businessPublicId` (decide the exact names before coding; keep the column names with `@map` if the table should stay as it is, or rename them in the migration since the database is local and can be reset). The rename touches every `publicId` in `lib/shop-paths.ts`, `lib/shop-auth.ts`, the `x-shop` header (`SHOP_HEADER`), the `/shop/[publicId]` and `/business/shops/[publicId]` folders, `MyShop`, notifications and the seeders; find them with a search for `publicId` before starting

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
- [x] Refuse non-ACTIVE users at login, write `lastLoginAt` on login (26 Oct 2026)
- [ ] Record login events with `logActivity`

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
- [x] Rate limiting on login, register, forgot / reset password (26 Oct 2026): two layers in `lib/rate-limit` (memory per instance, then a shared `RateLimit` table in Postgres); policies in `policies.ts`. Sign-in checks first and counts only FAILED passwords, a good sign-in clears the per-email counter, a refused forgot-password for one address answers like a sent link. The database reports "ms left in the window" (all times in UTC), never a date. Requests with no readable IP (local dev) skip the per-IP limits. Swap `db-store.ts` for Redis if traffic outgrows it. Per-IP limits trust `x-forwarded-for`, so they are only reliable behind Vercel
- [x] Password reset sets `passwordChangedAt` and revokes sessions. `passwordChangedAt` is still written but never read (a JWT issued before a change is only stopped by the revoked session)
- [x] `lastActiveAt` is written at most every 5 minutes (`lib/session-activity.ts`). The JWT callback still does up to 3 queries on every `auth()` call (15 call sites)
- [x] Hash reset tokens at rest
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
- **Data:** `Plan` (key, name, price, limits and feature flags), `Subscription` (business, plan, status, period, trial; **the plan belongs to the business, decided 26 Oct 2026**, limits count across its shops). A business with no subscription is on the free plan
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
- Open: the real limits per plan. **Prices (26 Oct 2026, placeholders):** Pro 40 TND / month or 400 TND / year, Business 100 TND / month or 1000 TND / year (two months free, about 17% off). Both prices are stored on the plan, not worked out, so each can be changed alone: `npm run db:set-price -- PRO --monthly 45 --yearly 450`

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
- [ ] **Person profile** (shop staff and business-client staff need their own details): name, photo, phone, job title, language, timezone. "Where I work" (shops and roles) is built (R2c, on `/profile`); the rest is open
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
- [x] **Plans and limits (26 Oct 2026):** `Plan` and `Subscription` per business, default plans, `checkLimit()` wired into create shop, create product and invite (off until `PLAN_LIMITS=on`), Business → Subscription page. Still open: upgrade and downgrade flow, trial on approval, enforcing seats when an invite is accepted, payment and invoices (see the 26 Oct entry under R2)
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
**Order of work (agreed 18 Oct 2026, updated after decisions 8 and 9):** R2a (done), **B1 Business level** (done), R2c team and invites and the Business area (built), then **R2e custom roles** (20 Oct, before the rename and R2d), then R2d plans and user management (plan on the business), then R2b real email and hardening (last, it needs a service chosen). Invites before email are **copy-link** invites.

**R2e, Custom roles (decided 20 Oct 2026, replaces the fixed role list; comes BEFORE R2d and before the Provider-to-Shop rename)**
Decision 11 (20 Oct 2026). Words: **Business** = the company (the provider), **Shop** = a storefront (same as "store"; never a warehouse). Local database only, so reset and reseed; **no compatibility layer**.
- **Roles live in the database** (`Role` table: name, scope BUSINESS or SHOP, owning business or shop, permission set, `isSystem`). Business roles and shop roles are **separate lists**; a business role is never a shop role
- **Default roles per level:** a built-in **Owner** for the business and a built-in **Shop owner** for a shop (both fixed: hold everything, cannot be edited or deleted). Other starter roles are copies the owner may edit
- **Shop creation:** the business owner(s) are the owner of every shop of their business by default (inheritance, as today); a **Shop owner** can also be assigned to a person for one shop only
- **Custom roles at both levels:** a business owner builds business roles, a shop owner builds shop roles
- **Permissions by module:** a role picks modules (products, orders, stock, team, billing, insights, ...) and what it may do in each; the screen explains each permission in plain words; "duplicate this role" button
- **No grants and no denies:** a person's access is the union of their assigned roles
- **Safety:** nobody grants a role or permission they do not hold; a role in use cannot be deleted until its members are moved; editing a role applies at once and is audited; the last Owner is protected (`assertKeepsAnOwner` stays)
- **Business role vs shop role (decided 20 Oct 2026):** a business role is never assigned inside a single shop. To give someone access to one or two shops, give them a **shop role** in each (shops have the same modules, so create or duplicate the role per shop). To give access to all shops of the business, the business role carries a **"manage shops" permission** with the shop modules it may use; without it the person sees only the business dashboard, never a shop dashboard
- **Decision 11 (20 Oct 2026, final; replaces the role design above):** **one role model, two possible owners.** An `AccessRole` is owned by a **Business** (usable in the business and in any of its shops) or by a **Shop** (usable in that shop only). Same table, same evaluation, same rules. No `key`, no `isSystem`: defaults (Owner, Manager, ...) are seed data copied as ordinary rows when a Business or a Shop is created; nothing in code depends on a role name. **Grants and denies are dropped** (access = union of live roles; `expiresAt` and status stay on the assignment). Shop managers may create and edit roles for their own shop. **Last-owner rule by permission** (`team.ownership.transfer`), not by a role called OWNER. `*` ("everything, now and later") is an ordinary tick for any role at its own level, bounded by "you can only grant what you hold". Rename the Prisma model `Provider` to `Shop` (`@@map("Provider")`, keep column names with `@map`). Add opaque unique `publicId` to Business and Shop and use it in URLs (`/provider/shops/[publicId]`). Local database: reset and reseed, no compatibility.
- **Phases:** 1) schema + role templates + seeding + access code + tests; 2) role editor screens (business and shop) with clone and delete, team pages without role keys; 3) `publicId` + URLs + the Shop rename
- [ ] Open, to confirm: who may create roles (a "manage roles" permission the Owner holds and can delegate, recommended); with "manage shops", does the role carry the shop module permissions ticked in it into every shop (recommended)
- [x] **Phase 1 (built 20 Oct 2026, being verified).** Schema: `AccessRole` is owned by a business or a shop (`businessId` / `providerId`), no `key`, no `isSystem`; `AccessAssignment` loses `grants` / `denies`; no new table, so no audit line to add. `prisma generate` needed
- [x] Phase 1 code: `lib/access/role-templates.ts` (seed data only, replaces `roles.ts`), `role-seed.ts` (default roles copied into a new business / shop; `findOwnerRole`), `evaluate.ts` = union of roles, last-owner rule by permission (`OWNERSHIP_KEY`, `owners.ts`), team pages and routes use role ids, `roleUsableAt`, `npm run access:sync` rewritten (no more backfill script). Still open for Phase 2: catalogue regrouped by module / sub-module (`docs/ROLES_PERMISSIONS.md`)
- [x] **Phase 2 (built 20 Oct 2026, being verified).** Roles screens at both levels: Business area > Roles (business roles + the roles of each shop the person may see) and `/provider/roles` for shop managers (linked from the Team page). List, **New role**, **Edit**, **Clone**, **Delete**; permission picker grouped module > resource > action with master switches and an "Everything" tick; keys you do not hold cannot be ticked. Routes: `POST /api/provider/roles`, `PATCH` / `DELETE /api/provider/roles/[id]`. Rules (pure, `lib/access/role-rules.ts`, tested): name unique per owner, you only give keys you hold, you cannot change or delete a role that holds keys above you, a change cannot leave the level without an owner, a role in use (people or waiting invitations) cannot be deleted (move them first). Written to the activity feed as `TEAM_ROLE_*`. Business roles need `business.role.manage`; shop roles need `team.role.manage` in that shop
- [ ] Still open from the 20 Oct design: regroup the catalogue into module / sub-module / create-edit-delete keys (`docs/roles_permissions.md`); the picker groups today's keys as they are. Platform (admin) roles have no editor yet
- [x] Reset and reseed (`migrate`, `db:seed`, `seed-demo`, `access:sync`)
- [x] **Naming settled (20 Oct 2026): the company stays `Business`**; only `Provider` becomes `Shop` (Decision 10 of 19 Oct is superseded). Step 1 built (UI and wording, no schema change): the shop form says **Shop name** (it used to say "Business name"), the first application also asks for the **business name** (defaults to the shop name), the shop switcher never repeats the shop's own name, admin says "Shops", "Become a provider" is "Open a shop". "Provider" survives only as the account type. Step 2, still to do: rename the Prisma model `Provider` to `Shop` (`@@map`, keep column names with `@map`) and add opaque unique `publicId` to Business and Shop for URLs (`/provider/shops/[publicId]`)
- [x] **Shop / business schema step (21 Oct 2026, Explorer v47).** Prisma model `Provider` is now `Shop` (`@@map("Provider")`, the table keeps its name); `Shop.name` replaces `businessName` (column still `businessName` through `@map`), so the shop name and `Business.name` can no longer be confused in code; `publicId` (opaque, unique) on Shop and Business; `Shop.businessId` is required. Switchers: the shop switcher groups shops under their business when there are several; the business picker shows how many shops each business has; the profile page groups by business id. Demo seed: every demo shop has a company (`Demo - Carthage Group SARL` owns two shops) and `access:sync` no longer invents businesses. Still to do: URLs that use `publicId` (`/provider/shops/[publicId]`), renaming the `providerId` columns/relations to `shopId`, "Move shop to another business".
- [x] **Main seeder (22 Oct 2026, Explorer v51).** `npm run seed` (or `db:seed`) runs `prisma/seed/index.ts`, which calls one seeder per kind of data (`seeders/`: platform, categories, catalogue, businesses, shops, access, products, users), one file each with its own data at the top. Run `npm run seed` (same as `db:seed`), `npm run seed products` (that seeder plus what it needs; `-- --exact` for only it), or `-- --list`, `--skip a,b`, `--kind reference|demo|test`. With NODE_ENV=production only `reference` seeders run. Replaces `seed.ts`, `seed-demo.ts`, `seed-team.ts` (the test accounts and invitations are now `seeders/users.ts`; password `demo1234`, same invite links as before). `access:sync` and the `access` seeder share `lib/access/sync.ts`. Data and plan tests: `prisma/seed/seed.test.ts`.
- [x] **Roles and team redesign (22 Oct 2026, Explorer v52).** Roles: the list (`/provider/roles`, `/business/roles`) has search, filters (place, access level, in use) and sorting; New role and Edit role are their own pages (`/…/roles/new`, `/…/roles/[id]`, with `?clone=<id>` to start from a copy); a role someone may not change opens read-only. Business owners pick which place (business or a shop) the new role belongs to. Server side: `lib/access/role-pages.ts` (who may view or manage which place), `lib/access/role-list.ts` (filter, sort, summary; tested). Team: `TeamSection` has an "Invite someone" panel, avatars, a "..." menu for suspend and remove, People / Waiting to join tabs, and search and filters from 5 people on (`lib/access/team-filter.ts`, tested). No schema change, no API change. Removed: `components/access/RolesManager.tsx`.
- [x] **Shop pages live under `/shop/[publicId]/...` (24 Oct 2026, Explorer v63).** `/provider/*` is gone: dashboard, products, team, roles, activity, profile and the coming-soon modules are now `/shop/<publicId>/dashboard`, `/products`, `/team`, `/roles`, ... The address decides the shop (`requireShopPage(publicId)`, `lib/shop-auth.ts`; a shop you do not work in is a 404), so two tabs can show two shops. `/shop` alone is a landing that opens the shop you used last (`/shop?to=team` opens that section). Browser calls to shop APIs send the shop in an `x-shop` header (`shopFetch`, `lib/shop-fetch.ts`; `requireShop` checks it against your assignments and falls back to the cookie without it). The switcher navigates to the same section of the other shop; the cookie only remembers the last one. Paths are built with `lib/shop-paths.ts` (tested). Notifications and activity lines link to `/shop/<publicId>/...` (the Business activity page omits shop links). No schema change. API and component folders renamed too (Explorer v64): `/api/shop/{apply,products,profile}`, `/api/team/*`, `/api/roles/*`, `/api/business/profile`, `/api/admin/shops/*` (page `/admin/shops`); components in `components/shop/`, `TeamSection` in `components/access/`, `BusinessForm` in `components/business/`. Still open: the Business area still uses a cookie for the active business (same idea with `Business.publicId`); lib files still named `provider-*.ts`.
- [ ] **API and permission tests (added 24 Oct 2026).** Today only pure logic is tested (`npm run test:unit`); no route, guard or database code is. Plan: `npm run test:api` with Vitest against a separate local test database (reset and seeded with the existing `demo1234` accounts). Tests import a route's `GET` / `POST` / `PATCH` / `DELETE`, call it with a `Request` and replace `auth()` with a fake signed-in user. First targets, the permission rules: `requireShop` (wrong shop in `x-shop` is 403, a shop you do not work in is 403, no header falls back to the cookie, an unapproved shop is refused), `requireBusiness`, team routes (invite, change role, suspend, remove, last-owner rule, expired or reused invite link, an invite for another email), role routes (only grant keys you hold, a role in use cannot be deleted), products (viewer cannot create or edit prices), notifications written with the right links. Later: a few Playwright click-through tests (log in, switch shop, invite and accept).
- [x] **Business → Shops, create and edit (25 Oct 2026).** `/business/shops/new` is the create-shop page (the business is known, so no business question; the shop starts "waiting for approval" and you land on its page); the Business shop page (`/business/shops/[publicId]`) now has the full shop details form (same form and rules as the shop's own profile, a live shop is saved through `/api/shop/profile` with the `x-shop` header, a waiting one through the application route and only by its applicant) and a "things left to fill in" checklist (`lib/shop-setup.ts`, tested). "Create shop" in the Business area points to the new page; `/become-provider` sends people who run a business there. The apply route also returns `publicId`. No schema change. Still open: the shop's team and products are not editable from the Business page (team is on Business > Team; products need the shop dashboard); editing a waiting shop is limited to its applicant
- [x] **Shop and product status, shops list and shop tabs (25 Oct 2026, Explorer v68 to v75).** Schema: `Shop.status` (`ShopStatus`: DRAFT, PENDING, ACTIVE, SUSPENDED, CLOSED, default PENDING) replaces `isVerified`; `Product.status` (`ProductStatus`: DRAFT, ACTIVE, HIDDEN, BLOCKED, default ACTIVE) replaces `isActive`. One migration (`shop_and_product_status`) that keeps the data (approved shops become ACTIVE, inactive products HIDDEN); no new table. Rules are pure and tested: `lib/shop-status.ts` (who may move a shop where), `lib/product-status.ts`, `lib/shop-list.ts` (search and filter). Only ACTIVE shops can be opened or sell; the guards say "not approved yet" or "closed or suspended". Owners send for approval, close and reopen through `POST /api/business/shops/[publicId]/status` (new permission `business.shop.change_status`); the platform team approves, suspends and reinstates (`/api/admin/shops/[id]/suspend|reinstate`), and blocks or unblocks a product (`/api/admin/products/[id]/block|unblock`, permission `product.listing.hide`). Business area: `/business/shops` is a table (shop and place, status, products, team, setup "4/5", one "..." menu per row; search and status filter from 5 shops; Show more). A shop has its own layout with the shop name, status pill, an **Actions** menu and tabs **Details | Team | Roles | Activity** (`/business/shops/[publicId]/...`); the header stays put while switching tabs. Details is two columns (contact and "at a glance" on the right). Team is managed here too (the shop's own team page stays for shop-only managers); Roles lists the shop's roles (open, clone and create use the Business role pages); Activity is the same feed as the shop's own page (`ShopActivityFeed`). Shared pieces: `RowMenu` (window-positioned so tables cannot clip it), `ThroughBusiness`, `StatusPill`. Run `prisma generate`; reseed so owner roles get the new permission. Still open: DRAFT is never created yet ("Create shop" makes PENDING); no admin screen to block a product; Business status (suspend a whole company); a role saved from the shop's Roles tab returns to the Business roles list.
- [x] **After this:** rename `Provider` to `Shop` in code (keep table via `@@map`), fix UI wording (layer 1 and 2 of the 20 Oct plan), then R2d. Done; R2d is under way (shop and product status and user management built 25 Oct 2026; the plans skeleton is postponed, see below)

- [x] **Plans (26 Oct 2026, Explorer v50).** The plan belongs to the **business** (the account holder; limits count across its shops). Schema: `Plan` (key, name, price, `limits` and `features` as Json) and `Subscription` (one per business: plan, status TRIALING / ACTIVE / PAST_DUE / CANCELED, trial end, paid period, note), migration `20261026120000_plans_and_subscriptions` with the audit triggers. A business with no subscription is on FREE, so nothing is backfilled. Rules in `lib/plans.ts` (pure, tested): default plans FREE / PRO / BUSINESS with the placeholder limits of decision 4 (shops, products, team seats, warehouses, custom taxes), `evaluateLimit`, `planInForce` (trial ends, period ends, past due, canceled). Database side in `lib/plan-limits.ts`: `planForBusiness`, `usageFor` (counted across the business's shops; a closed shop gives its place back), `checkLimit`, `limitBlock`. `limitBlock` is called by create shop (`/api/shop/apply`, for an existing business), create product (`/api/shop/products`) and invite (`/api/team/invites`, only when the person is not already on the team). **Limits only block when `PLAN_LIMITS=on`**; until then they are shown, not applied. `npm run seed plans` creates the plans (never overwrites an edited one); `npm run db:set-plan -- <business public id> PRO --months 12 --note "..."` sets a plan by hand (FREE removes the subscription). Business → Subscription shows the plan, what is used and a comparison table with a Monthly / Yearly switch (prices entry below). Still open: the real limits; upgrade and downgrade flow; 14-day Pro trial on approval; a seat check when an invite is accepted (today only when it is sent); admin screen to set a plan; the over-limit banner and 30-day seat grace after a downgrade; warehouses and custom taxes are shown but have nothing to count yet; payment and invoices (backlog I).

- [x] **Plan prices, monthly and yearly (26 Oct 2026, Explorer v52, placeholders).** `Plan.priceYearly` next to `priceMonthly` (migration `20261026160000_plan_yearly_price`, which also fills the first prices for Pro and Business, only where a plan has none). Pro 40 / 400 TND, Business 100 / 1000 TND, Free has no price. The Subscription page has a **Monthly / Yearly switch** (`components/business/PlansTable.tsx`): the chosen period is the big price, the other period is shown under it, and the yearly view shows "Save 17%" and the monthly equivalent; the Yearly button says "Save up to N%". The display rules are in `lib/plans.ts` (`priceDisplay`, `yearlySaving`, tested). **Changing prices later:** the numbers live in the database, so `npm run db:set-price -- PRO --monthly 45 --yearly 450` (either one alone, or `none` to remove a price; written to the activity log) changes the page at once; the seed never overwrites an edited plan, except that a plan with no price at all (created before prices existed) gets the default prices when you run `npm run seed plans`. Still open: an admin Plans page to edit prices and limits without the command line; a **price snapshot on the subscription** when payments exist (today a price change would apply to everyone, because nothing is charged yet); which period a subscription is billed on (needs `Subscription.billingPeriod` with payments); ~~a public `/plans` page~~ built 26 Oct 2026 (below).

- [x] **Public plans page (26 Oct 2026, Explorer v54, redesigned after the first version looked too small).** `/plans` (no sign-in; `app/(public)/plans/page.tsx`): a hero, a large Monthly / Yearly switch (opens on Yearly, the Yearly button shows "Save 17%"), **one card per plan** (name, big price, the other period underneath, a "Most popular" mark on Pro, a "Start free" or "Get started with X" button to `/register`, a short list of what it includes), the full **Compare the plans** table, an **Included in every plan** panel, a six-question FAQ and a closing call to action. A "Plans" link sits in the navbar for visitors who are not signed in. Built from shared pieces in `components/plans/` (`PublicPlans`, `ComparisonTable`, `BillingToggle`); Business → Subscription uses the same table in its compact size. **More rows in the table** (`COMPARISON_GROUPS` in `lib/plans.ts`, four groups): Your business (shops, products, team members, custom roles), Running the shop (warehouses, custom taxes, low-stock alerts, bulk import), Reports and integrations (advanced reports, invoices and tax reports, API access), Visibility and support (priority placement, priority support). Rows for things that are not built or not applied yet carry a **Soon** tag (`SOON_KEYS`; remove a key when the thing works). New defaults: custom roles Free 1 / Pro 5 / Business unlimited; Pro adds low-stock alerts and invoices; Business adds priority support. A limit or feature that a plan row in the database does not mention now takes the default of that built-in plan, so new rows need no migration or seed. Open: the "Choose this plan" step that starts a subscription (needs payment); a link from the home page; French and Arabic text (Phase 6); a real count for custom roles (a role is not marked as custom yet). The Subscription page and the plan lookups also cope with a database or generated client one migration behind (a missing price column shows as "no price" instead of crashing).

- [x] **Terms, Privacy, Contact and help, footer, accept-at-sign-up (27 Oct 2026, Explorer v55).** New public pages `/terms`, `/privacy` (`components/legal/LegalDoc.tsx`: title, date, contents list, numbered sections) and `/contact` (first version: the email address and six common questions; replaced by the contact form below). The text lives as data in `lib/legal.ts` (so it can be translated and tested) and describes what the app really does today: what is collected, what is public, cookies (only sign-in and the remembered shop or business), rights, shops and plans. The site facts come from `lib/site.ts` and three env variables, `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL` (in `env.example`); the pages read cleanly without them and show the team a reminder in development only. A footer (Plans, Contact and help, Terms, Privacy) is on every public page. **Sign-up now needs the box "I agree to the Terms of use and the Privacy policy"**: `/api/register` refuses without `acceptTerms: true` and saves `User.termsAcceptedAt` and `User.termsVersion` (`LEGAL_VERSION` in `lib/site.ts`; migration `20261027010000_terms_acceptance`). **Before launch:** fill the three env values, have a lawyer read both texts (they cite Organic Law no. 2004-63 and the INPDP; check they are still the right references), and decide the real retention and deletion wording. Open: ask existing accounts (null `termsAcceptedAt`) to accept on their next sign-in, and everyone again when `LEGAL_VERSION` changes; a link to the Terms and Privacy on the shop application; French and Arabic text.
- [x] **Contact form and team inbox (27 Oct 2026, Explorer v56).** `/contact` is now a real contact page: a form (name, email, topic, message up to 2000 characters) that stores the message, with the common questions below it and the direct email when set. Signed-in people get name and email filled in. `POST /api/contact` is open to everyone; a hidden "website" field catches robots (they get the normal answer and nothing is stored) and one sender (same email or address) may send 3 an hour and 10 a day. Messages go to the new table `ContactMessage` (topic, status NEW/READ/HANDLED, optional user, address and browser, audit-attached; migration `20261027100000_contact_messages`). The team reads them at **Admin, Messages** (`/admin/messages`): tabs with counts, newest first, paging, a "Reply by email" link, and buttons to mark read, handled or new again (`PATCH /api/admin/messages/[id]`). Viewing needs `support.ticket.view_all`, changing needs `support.ticket.change_status` (existing keys). Pure rules and tests in `lib/contact.ts`. The footer component is now `components/Footer.tsx` (was `SiteFooter`). Open: no email notification to the team when a message arrives, and no email sent back from the app (the reply opens the team member's own mail program); this inbox is the seed of the Support module (tickets with threads, assignment, priority); old messages are never deleted yet (set a retention period, see the Privacy text).
- [ ] **More public pages (list of 27 Oct 2026):** search and browse products with category pages and a public shop page (Phase 4, the heart of the marketplace); a "How it works" page and a "For shops" page; a better home page that links to plans and how it works; `robots.txt` and a sitemap; page titles and descriptions on every page; a cookie notice only if analytics are added.

**Next steps of 26 Oct 2026 (agreed after the status and user-management push; Explorer v48 is main at 12e8a60)**

What the 25 Oct work left open on accounts, and the order to do it in. Nothing here needs a plan or a subscription.
1. [ ] **Platform staff management** (the "Staff" page described in Phase 5). First, because every item below needs people who are not the developer to work as admin or support. Today admins exist only through the database or the seed.
2. [ ] **Ban** (`User.status = BANNED`): `lib/user-status.ts` already has the status, the sign-in check and the label; missing are the action, a reason shown to the admin, the "..." menu entry, and the rule for what a ban means (cannot sign in, sessions ended, same email cannot register again). Small.
3. [ ] **Own-account deletion** (`PENDING_DELETION`): the person asks from their account page, with a password check and a grace period (for example 14 days, they can cancel by signing in); the last owner of a business or shop must hand over or close it first (the rule in the Phase 5 note: closing the last owner's account suspends the shop and notifies admin); after the grace period a job anonymises the account and keeps orders and the activity log readable. Needs a decision on what is kept.
4. [ ] **Admin user detail page** (`User.publicId`, `/admin/users/[publicId]`): a read-only page where support and admins can read an account (profile, shops and roles, sessions, status history, account activity) without logging in as that person. This is the safe default for most support questions.
5. [ ] **Impersonation ("View as")**, Phase 7: `ImpersonationSession` with banner and auto-expiry, read-only by default, writing needs a separate permission and a reason, credential, payout and account-deletion actions blocked, every action logged as the real admin on behalf of the user, and the user sees "support accessed your account" in their activity. The permissions (`impersonation.session.*`) and the audit fields (`impersonationId`, `onBehalfOfId`) already exist; the session model, banner and routes do not. Mandatory 2FA for anyone who can start one comes first (Phase 7).
6. [ ] **Support module** (Phase 8): tickets with a "view as requester" link (uses 4 and 5), inbox, internal notes, feature requests board. Starts once 1, 4 and the read-only part of 5 exist.

Checks found when reading the 25 Oct push (to settle with the items above):
- [x] A suspended person was told "wrong email or password" at sign-in. Fixed 26 Oct 2026: after the right password, `auth.ts` refuses with a code (`account_suspended`, `account_banned`, `account_pending_deletion`) and the login page shows the matching message (`lib/user-status.ts`). The reason the admin typed stays in the activity log; the person is only told the account is suspended (comment corrected).
- [x] Suspending the last platform owner is now refused (26 Oct 2026): `assertPlatformKeepsAnOwner` in `lib/access/owners.ts`, platform staff counted per person, owner = holds `access.assignment.grant` (`OWNERSHIP_KEY.PLATFORM`). Ban must call it too when it is built. Still open: closing the last owner's account of a business or shop must suspend the shop and notify admin.
- [x] Password reset tokens are hashed (26 Oct 2026, `lib/reset-token.ts`; `PasswordResetToken.token` now holds the SHA-256, no schema change; links issued before this change stop working). The force-reset link is still shown to the admin until email exists (R2b).
- [ ] No customer-facing product list exists yet. When the storefront (R3) is built it must filter both `Product.status = ACTIVE` and `Shop.status = ACTIVE` (`isListed` and `isLive` in `lib/product-status.ts` and `lib/shop-status.ts`).
- [ ] Closed and suspended shops are refused by `requireShop` on every shop route; owners can still reopen a closed shop from Business → Shops (the status route does not use `requireShop`). Confirm that is the wanted behaviour.

Postponed on purpose:
- ~~**Plans skeleton**~~ Built after all on 26 Oct 2026 (see the entry above); the owner is the business.
- **`providerId` to `shopId` rename.** Needs a hand-written `RENAME COLUMN` migration (Prisma would drop and re-add the column), index and foreign-key renames, and a replacement of the `audit_log()` trigger function, which reads the key `providerId` from the row. Tables touched: Product, CatalogSuggestion, AccessRole, AccessAssignment, AccessInvite, ActivityLog (and the `User.providers` relation field). A first version was started on an older main and dropped when main moved; redo it on the current main when nothing else is in flight.
- **Move a shop to another business** (owner action), and the cleanup script for the two-business data.

**B1, Business level (built 18 Oct 2026, being verified)**
- [x] Schema: `Business`, `Provider.businessId` (nullable for now), `AccessAssignment.businessId`, `AccessScope.BUSINESS`; audit line for `Business` (added by hand to the migration)
- [x] Permission model: business keys (`business.profile`, `business.shop`, `business.team`), BUSINESS roles (Business owner, Business accountant), inheritance into shops in `lib/access/evaluate.ts` (a shop check passes the shop's `businessId`), `lib/access/reach.ts`, tested
- [x] Guard and loaders follow it: `requireShop` (inherited shops), new `requireBusiness`, shop switcher (names the business when you work in several), notification recipients include business-level members, last-owner rule can run on a business (`assertKeepsAnOwner`)
- [x] Apply creates the business with the shop; "Create shop" adds to a business you own (or a separate one, `lib/business-choice.ts`); approve makes the applicant business owner; reject and withdraw remove an empty business
- [x] `scripts/backfill-businesses.ts` (`npm run db:backfill-businesses`, `--dry` first) and `npm run access:sync` (creates the business roles) for existing data
- [x] **Business** page (now `/business/profile`, in the Business area; `/provider/business` redirects there) with legal and billing details, saved through `/api/provider/business`; legal fields only for the business owner
- [ ] **Contract step:** after the backfill, a later migration makes `Provider.businessId` required (and `prisma/tests/audit-foundation.sql` must then insert a Business first)
- [x] The "Create shop" form asks which business the shop belongs to ("Add to X" or "A separate business"); a first application has no choice to make
- [x] Team page (business or shop level): built in R2c below

**Decision 10 (19 Oct 2026): split Provider and Shop.** Today the word Provider means the shop (table `Provider`, route `/provider`) and the company above it is `Business`. Target: **Provider = the company**, **Shop = the outlet**, each with its own table.
- **Provider** (the company; today's `Business`, renamed) holds: name, legal name, legal form, tax number, tax settings, registry number, billing email / phone / address, logo, website, industry, currency (ISO), language, order number sequence, invoice number sequence, invoice language, payment terms (days), delivery terms, and later its plan (R2d)
- **Shop** (today's `Provider`, renamed) holds what is specific to an outlet: name, address and map pin, phone, opening hours, products, its team
- User role `PROVIDER` (which dashboard opens) and the people-level access model do not change
- Routes: shop pages move `/provider/*` → `/shop/*`; the company area moves `/business/*` → `/provider/*`
- **R2e plan (own release, nothing built yet):** (1) migration by hand, in one transaction: rename tables (`Provider` → `Shop`, `Business` → `Provider`), rename the columns that point at them (`providerId` → `shopId`, `businessId` → `providerId`) on every table that has them (Product, AccessAssignment, AccessInvite, ActivityLog and the rest), keep every id, then add the new company columns; (2) mechanical rename of about 70 + 54 files by script, then `tsc`; (3) permission keys `business.*` → `provider.*` and `npm run access:sync`; (4) company profile form with the new fields; (5) redirects from the old URLs. Risk: the two names swap, so it must be reviewed as SQL before it runs, on a copy of the database first

**R2c, team and invitations (built 18 Oct 2026, verified in use)**
- [x] Schema: `AccessInvite` (shop or business scope, role, email, hashed token, expiry, status PENDING / ACCEPTED / REVOKED) + enum `InviteStatus`; audit line `SELECT audit_attach('AccessInvite', '', 'tokenHash');` goes in the migration by hand
- [x] **Copy-link invites** (decision: email later, R2b): the link is shown once, only its hash is stored; "New link" replaces the old one for the same person; valid 7 days; bound to one email address (whoever opens it must be signed in with that address); opens `/invite/[token]`, which sends people to sign in or register and back (`?next=`, only paths inside the site). The accept checks are a pure, tested function (`lib/access/invite-accept.ts`); single use is an atomic claim in the route
- [x] **Shop team page** (`/provider/team`): the shop's people. Invite, change role, suspend / reinstate, remove, leave, cancel invitation. People who work through the business are listed read-only, with a link to the Business team for those who manage it. Styled confirm dialogs and toasts
- [x] **Rules** (`lib/access/team-rules.ts`, tested): nobody gives, changes or removes access they do not hold themselves (a manager cannot create or touch an owner); nobody changes their own role or suspends themselves (leaving is allowed); a business always keeps a business owner; a shop keeps an owner, and a live owner of its business counts, so a branch needs no owner of its own
- [x] **Ownership transfer** = an owner makes someone else owner (role change), then may step down. The extra step-up check (password / 2FA) comes with R6
- [x] Accepting makes a plain client a provider for routing (`User.role`); removing the last place someone works sends them back to client (an admin is never touched)
- [x] Everything is audited (triggers) and written to the activity feed in plain words (`TEAM_INVITED`, `TEAM_JOINED`, `TEAM_ROLE_CHANGED`, `TEAM_SUSPENDED`, `TEAM_REINSTATED`, `TEAM_REMOVED`, `TEAM_INVITE_CANCELLED`); the member gets a notification, and the inviter is told when someone joins
- [x] **Activity page** (`/provider/activity`) and "last changed by" on the product edit page; **Where I work** on `/profile`
- [x] Fix found on the way (B1 follow-up): page-side `shopCan()` ignored business-level roles, so a business owner would have lost the price, stock and restore controls after the backfill
- [ ] Open: removing a member does not revoke their login sessions (R6); invitation emails (R2b); per-person extra permissions and custom roles; seat limits from plans (R2d)

**R2c-2, Business area (built 18 Oct 2026, being verified)**
Decision 9 (18 Oct 2026): the Business is part of the **account**, not of the shop. It does not go in the shop sub-nav or the shop switcher (the switcher stays about shops only). Plan and billing (R2d) will live in the same place. Security (2FA, sessions, password) stays **personal**: it belongs to the person, not the business. Later a business may require 2FA for its team (R6).
- [x] **Business area** at `/business` with its own tabs: Profile, Subscription, Team, Shops, Activity, Roles (the active tab is highlighted); the header names the business. No schema change
- [x] **Business picker** for people who belong to several businesses: cookie `bayna_business`, never trusted (checked against live business-level roles on every request, `lib/access/active-business.ts`), `POST /api/me/active-business`. The guard (`requireBusiness`) and the pages use the same choice; without one it is the business of the shop you are working in
- [x] **Entry in the account menu**: "Business" shows only for people who hold a business-level role (`GET /api/me/businesses`); a shop-only manager never sees it. The "Business" link is gone from the provider sub-nav and `/provider/business` redirects to `/business/profile`; `proxy.ts` gates `/business` like `/provider`
- [x] **Business → Shops:** the business's shops with status, "Open shop" (switches the active shop) and "Create shop" (needs `business.shop.create`)
- [x] **Business → Team:** "Everyone" overview (each person once, with their business role and role in each shop), the business team, and a collapsible team per live shop; owners manage shop-level people from here too. Invites name their target (shop or business), so they work from this page
- [x] **"Where I work"** on the account page (businesses, shops, role in each)
- [x] Tests: invite token (hash, expiry, state), accept rules (wrong email, expired, cancelled, used, deleted target), role limits (nobody grants above their own), last-owner cases, active business pick, people overview
- [x] **Business → Subscription:** placeholder until plans exist (R2d). **Business → Activity:** business profile and team changes, plus team changes in its shops (found by what they are about, no schema change). **Business → Roles:** read-only list of the system roles (business and shop level) with what each can do; custom roles are planned
- [x] **Shop modules as icons next to the logo** (for people who work in a shop): Projects, Statistics, Team, Activity, Taxes, Banks, Shop profile. The name shows as a tooltip under the icon, and the icon turns green inside that module. Projects (kanban boards), Statistics, Taxes and Banks are **Soon** placeholders so the layout is final. The shop sub-nav keeps Overview and Products
- [x] **Invite fix:** you cannot invite your own address, someone already on that team, or (for a shop) someone who already reaches the shop through the business (`checkInvitee`, tested)
- [ ] Open: custom roles; Plan and billing (R2d)
- [ ] **Gate:** invite someone to one shop and to the whole business by link, accept both, switch businesses with the picker, open a shop from Business → Shops, try to remove the last owner (must fail), sign in as a shop-only manager and confirm there is no Business entry and `/business` sends you back to the dashboard

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
- [x] **Plans skeleton** (decision 4), built 26 Oct 2026: `Plan`, `Subscription` (per business), `checkLimit()`; an admin sets a plan by hand with `npm run db:set-plan`
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
