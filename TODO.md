# Bayna – Project TODOs

Last updated: 15 Oct 2026 (permission layer done; backlog ideas added)

Product: **local marketplace** (estimates + multi-provider orders). Price comparison is a feature, not the whole business.

Design details for access control, audit, impersonation and support live in
[`docs/access-audit-support.md`](docs/access-audit-support.md). This file stays a task list.

---

## Current focus

**Phase 7 foundation: audit columns, `ActivityLog` and the permission layer are done and verified
(15 Oct 2026).** Left in the foundation: wiring every write route to `withAudit` so the log records who
acted, then the provider profile (Phase 3a). The ideas collected on 15 Oct 2026 are in
[Backlog ideas](#backlog-ideas-added-15-oct-2026-not-started) below: not started, not ordered.

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
- [ ] 2FA (TOTP) for platform staff, required for anyone who can impersonate

## Phase 3 – Provider Side

### 3a – Onboarding & shop identity  ← **NEXT, right after the Phase 7 foundation**
- [x] “Become a Provider” application flow (pending until admin approves)
- [ ] **Provider profile page** (view + edit): businessName, description, phone, WhatsApp, address, city, governorate
- [ ] `PATCH /api/provider/profile` with input validation (same style as `lib/product-input.ts`)
- [ ] Location v1: governorate / city lookup fills latitude + longitude; store how it was set (lookup vs pin). Map pin picker later
- [ ] Show verification status on the profile. **Decided:** phone, WhatsApp and description save and log only; business name, address, city, governorate and location save, log and set `needsReview` for the admin (the shop stays live)
- [ ] Pending applicants can edit or withdraw their application (`PATCH` / `DELETE /api/provider/apply`, UI under `/become-provider`, because they are still CLIENT and cannot reach `/provider`)
- [ ] Write an `ActivityLog` entry with before/after values (audit columns come from Phase 7)
- [ ] Guard the route with `requirePermission("shop.profile.edit")` from Phase 7
- [ ] Optional later: opening hours, logo, delivery / pickup / COD options, open / closed / vacation status, public shop page
- [ ] Decide: can one provider have several locations / depots?

### 3b – Listings & pricing
- [x] Product management (add / edit / stock)
  - [x] List own products (server-side search, filters, sort, pagination)
  - [x] Create product (link to CatalogItem or free-form niche item)
  - [x] Edit product: price, stock, active flag
  - [ ] Edit product: **images** (pick storage first: Vercel Blob / Cloudinary / S3)
  - [ ] Delete product is a **hard delete** today ("cannot be undone"). Move to soft delete / Active flag before orders exist
- [x] Product form redesign: choose catalogue vs custom up front, short linked form, one action bar
- [x] Suggest a custom product for the catalogue on create (CatalogSuggestion)
- [ ] Suggest an existing custom product for the catalogue from edit
- [ ] Inline / quick edit of price and stock on the products table
- [ ] Bulk edit, CSV import / export, quick-add from the catalogue
- [ ] Price history and a "price last confirmed" date (`priceUpdatedAt`, not just `updatedAt`)
- [ ] VAT rule: prices consistently tax-inclusive or exclusive so comparison is fair
- [ ] Quantity price tiers (by pallet / ton) and delivery fee

### 3c – Orders & operations (marketplace core for the provider)
- [ ] Provider order inbox (only their OrderProvider slice)
- [ ] Fulfillment statuses (new → accepted → preparing → ready → completed / cancelled)
- [ ] Stock handling: treat an order as a request; no hold at estimate; decrement on accept; restore on cancel
- [ ] Dashboard beyond product stats: open orders, low-stock list, pending suggestions
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
- [ ] Decide: can one person work for several shops? (schema allows it; UI single shop at first)

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
- [x] Checks: `npm run audit:check` (every model has the columns), `npm run test:audit-db` (36 checks on a real database), `npm run test:unit`
- [x] `ActivityLog`: append-only (enforced by a trigger), field-level before/after, actor snapshot, on-behalf-of, source, request id, secrets redacted
- [ ] Reusable Timeline component: entity history tab, shop activity page, admin global audit, user "account activity" (logins, password and role changes, support access)
- [x] User columns added: `status`, `suspendedReason`, `lastLoginAt`, `locale`, `timezone`, `preferences`, `deletedAt`
- [x] Guard refuses non-ACTIVE users (also soft-deleted ones)
- [ ] Refuse non-ACTIVE users at login too, write `lastLoginAt` on login, record login events with `logActivity`

**Permission layer: what was checked (15 Oct 2026).** Same limits as before (no npm in the session):
- `lib/access` unit tests: 22 pass (catalogue, patterns, system roles, deny-wins, scopes, expiry, no escalation)
- `prisma/pending/access_audit_triggers.sql` applied on Postgres 16 on tables shaped like the new models: 36 database checks pass, array changes (`permissions`) are logged with before/after, `providerId` lands on assignment log rows
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
- [ ] **Deploy:** `app/generated/prisma` is gitignored and there is no `postinstall: prisma generate`; a fresh clone / Vercel build has no client
- [x] **Prisma 7 config:** `prisma7.config.ts` is picked up automatically (`prisma validate` loaded it on 15 Oct 2026). Nothing to rename
- [ ] Lowercase / trim emails on register, login, forgot and reset (avoid duplicate accounts)
- [ ] Price must be greater than 0 (`parsePrice` accepts 0, which would top every comparison)
- [ ] Unit changes (admin edits a catalogue item's unit, or a suggestion is merged into an item with another unit) overwrite linked products' units but not their prices. Warn, or make the provider re-confirm the price
- [ ] Navbar and provider sub-nav link to `/provider/orders`, which does not exist
- [ ] Page metadata still says "Create Next App"; add `error`, `not-found` and `loading` pages
- [ ] Remove the stale "WORKSPACE NOTE" comment in the provider reject route

Then:
- [ ] Real email sending (Resend or similar); reset links are only `console.log`ged
- [ ] Rate limiting on login, register, forgot / reset password
- [ ] Password reset should set `passwordChangedAt` and revoke sessions; `passwordChangedAt` is written but never read
- [ ] JWT callback does up to 3 queries + a write on every `auth()` call (15 call sites); throttle the `lastActiveAt` update
- [ ] Hash reset tokens at rest
- [ ] Tests for the pure logic (`product-input`, `product-filters`, slug / catalogue input) and a CI workflow
- [ ] Verify end to end: a newly approved provider can reach `/provider/*` without logging out (proxy reads the role from the JWT cookie)

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
- Questions: which 2FA methods (authenticator only, or SMS / WhatsApp too); is 2FA mandatory for admins and shop owners

### B. Inventory management (beyond a stock number)
Today a product has a single `stock` integer. The permission keys `inventory.location.manage` and
`inventory.adjustment.create` already exist.
- [ ] **Stock ledger** (append-only movement book): every change is a row (received, sold, adjusted, returned, counted, transferred) with quantity, reason, who, when and the order it came from; `stock` becomes the running total. Gives a history per product and makes order accept / cancel restore stock correctly (see 3c)
- [ ] **Reorder queue:** low-stock and out-of-stock list with a reorder point per product, status (to order / ordered / received), optional supplier and expected date; feeds the provider dashboard and notifications
- [ ] **Stock adjustments and counts:** manual correction with a required reason; stocktake mode
- [ ] **Locations** (shops with more than one site or warehouse) when a shop needs it
- [ ] Permission checks use the existing keys; `product.stock.edit` stays the quick edit, the ledger records it
- Questions: "ledger book" is read here as the stock movement ledger. If you also meant an accounting ledger, that belongs to billing (group I). One site per shop at first, or locations from the start?

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
- [ ] **Decide the revenue model** (can be combined): commission on completed orders, monthly subscription plans for shops (limits on products and team seats), paid placement or featured listings, fee per accepted order request
- [ ] **Plans and limits:** plan table, per-shop plan, limit checks (products, team seats), upgrade and downgrade
- [ ] **Commission statements and invoices to providers:** monthly statement from completed orders, invoice with legal numbering, payment status and due date
- [ ] **Collections:** record payments (bank transfer, card or local payment methods once chosen), overdue reminders, restrict or suspend a shop after a grace period (ties to shop states in 3e)
- [ ] **Admin billing page:** revenue, receivables, overdue shops, commission by shop and category, exports; the finance role and keys (`finance.commission.*`, `finance.payout.*`) exist
- [ ] **Financial ledger:** an append-only record of money events behind the statements
- Questions to answer first: commission rate and whether it varies by category; free tier and trial; how a shop pays (transfer, card, local wallet); who issues the commercial invoice for an order; legal and tax treatment in Tunisia (needs an accountant)

---

## Next up (proposed order, reorder freely)

1. **Phase 7 foundation** — chosen first: audit columns + ActivityLog, then permissions + guard (before orders, so every order action records who did it)
2. **Provider profile (3a)** — chosen second
3. Phase 9 quick fixes (deploy, emails, price > 0, dead link); the `postinstall: prisma generate` fix is needed as soon as schema work starts
4. 3b listing operations: images, inline price / stock, soft delete
5. Phase 4: search, comparison, location and travel cost
6. Estimate → order schema → provider inbox
7. Phase 8 support module; impersonation once staff roles exist
8. Team UI (3d) when a shop needs a second login

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
- Open questions: can staff change prices (default: owner and manager only); can one person work for several shops; should users be told when support accesses their account (recommended: yes)
