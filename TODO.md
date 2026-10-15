# Bayna – Project TODOs

Last updated: 15 Oct 2026 (merged two versions, audited against the code)

Product: **local marketplace** (estimates + multi-provider orders). Price comparison is a feature, not the whole business.

Design details for access control, audit, impersonation and support live in
[`docs/access-audit-support.md`](docs/access-audit-support.md). This file stays a task list.

---

## Current focus

**Phase 7 foundation first (audit columns + `ActivityLog`, then permissions + guard), then the provider
profile (Phase 3a).** Order chosen on 15 Oct 2026 so the profile is built on the real audit and
permission layers, not thin versions. Everything else below is queued, not started.

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
- [ ] `Role` + `AccessAssignment` models (permissions) → Phase 7
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
- [ ] Permission keys as typed code constants (`module.resource.action`), covering every module in three scopes: platform, shop, client
- [ ] `Role` table (data-driven; system roles seeded; custom shop roles possible later) + `AccessAssignment` (user, scope PLATFORM / SHOP, providerId, role, status, grants, denies, expiresAt)
- [ ] Resolution: role permissions + grants − denies; deny wins; computed per request, not stored in the JWT
- [ ] One guard API (`requirePermission`, `can`) used by every API route and page; replace `isAdmin()` and the inline role checks
- [ ] Test that fails when an API route has no guard
- [ ] Step-up (recent password) for sensitive actions: role changes, impersonation, ownership transfer
- [ ] Seed system roles: SUPER_ADMIN, ADMIN, SUPPORT_AGENT, SUPPORT_LEAD, CATALOGUE_MANAGER, MODERATOR, FINANCE, AUDITOR; shop OWNER, MANAGER, ORDER_HANDLER, INVENTORY_CLERK, ACCOUNTANT, VIEWER

**Audit columns and timelines**
- [x] Audit columns on every table: `createdAt`, `updatedAt`, `createdById`, `updatedById`. The actor columns are plain ids with no foreign key (decided 15 Oct 2026), so adding a table never means editing `User`
- [x] Soft-delete columns (`deletedAt`, `deletedById`) on User, Provider, Product, CatalogItem, Category. Nothing filters on them yet and routes still hard-delete
- [ ] Soft delete behaviour: filter on `deletedAt`, replace the hard deletes, partial unique indexes (`WHERE "deletedAt" IS NULL`) for `Product (providerId, catalogItemId)` and the slugs. Add the columns to orders and tickets when those tables exist
- [x] Stamp the actor automatically with **database triggers** (`audit_stamp`, `audit_log`) reading the actor from the transaction setting `app.audit`. New tables call `SELECT audit_attach('Name')` in their migration
- [x] `withAudit(actor, tx => ...)` and `logActivity()` in `lib/audit/`
- [ ] Use `withAudit` in every write route. Until then rows are logged with no actor and source SYSTEM. Done together with the permission guard, which knows the actor
- [ ] Seeds and scripts: use `systemActor("SEED")` so their rows are labelled
- [x] Checks: `npm run audit:check` (every model has the columns), `npm run test:audit-db` (36 checks on a real database), `npm run test:unit`
- [x] `ActivityLog`: append-only (enforced by a trigger), field-level before/after, actor snapshot, on-behalf-of, source, request id, secrets redacted
- [ ] Reusable Timeline component: entity history tab, shop activity page, admin global audit, user "account activity" (logins, password and role changes, support access)
- [x] User columns added: `status`, `suspendedReason`, `lastLoginAt`, `locale`, `timezone`, `preferences`, `deletedAt`
- [ ] Use the new User columns: refuse non-ACTIVE users at login and in the guard, write `lastLoginAt` on login, record login events with `logActivity`

**Audit foundation: what was checked (15 Oct 2026).** The session could not install npm packages, so
this was tested against a local Postgres 16 instead:
- the migration applies on top of the 8 existing migrations, on tables that already contain rows and on an empty database
- my own comparison script (a stand-in for `prisma migrate diff`) found no differences between `schema.prisma` and the database, and fails when a mismatch is planted
- `prisma/tests/audit-foundation.sql`: 36 checks pass. `lib/audit` unit tests: 11 pass. `lib/audit/actor.ts` passes `tsc --strict`

**Not checked. Run these on your machine before relying on it:**
1. `npx prisma validate`
2. `npx prisma migrate dev`: it should apply `20261015100000_audit_foundation` and report no further changes. If it wants to create a follow-up migration, send me that SQL
3. `npx prisma generate && npx tsc --noEmit` (this is the only check that covers `lib/audit/run.ts`)
4. `npm run audit:check && npm run test:unit && npm run test:audit-db`
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
- [ ] **Prisma 7 config:** file is `prisma7.config.ts`, Prisma auto-detects `prisma.config.ts`; confirm `migrate` / `generate` work or rename
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
