# Bayna – Project TODOs

Last updated: 13 Oct 2026

---

## Roles & Dashboards

| Role         | How assigned                         | Dashboard URL          |
|--------------|--------------------------------------|------------------------|
| **CLIENT**   | Default on registration              | `/dashboard`           |
| **PROVIDER** | Apply after CLIENT (+ optional approval) | `/provider/dashboard` |
| **ADMIN**    | Manual only (see below)              | `/admin/dashboard`     |

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

## Phase 1 – Core Data Model
- [x] Roles, Provider, Product, Category, location fields
- [x] LoginSession model (device/session tracking)
- [x] passwordChangedAt on User
- [x] Unit enum (piece, bag, m, m², m³, ton, roll, liter, other)
- [x] CatalogItem model (shared catalogue, optional link from Product)
- [x] Category improvements (parent/child, sortOrder, description)
- [x] Seed: 16 construction categories + ~200 catalog items

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
- [ ] Enrich LoginSession with real userAgent / IP on login
- [ ] Google / Facebook OAuth

## Phase 3 – Provider Side
- [x] “Become a Provider” application flow (pending until admin approves)
- [ ] Provider profile CRUD
- [x] Product management (add / edit / delete / stock)
  - [x] List own products (server-side search, filters, sort, pagination)
  - [x] Create product (link to CatalogItem or free-form niche item)
  - [ ] Edit product: price, stock, active flag done; images still to do
  - [x] Delete product (deactivate via the Active flag)
- [x] Product form redesign: choose catalogue vs custom up front, short linked form, one action bar
- [x] Suggest a custom product for the catalogue (CatalogSuggestion, provider side)
- [ ] Provider: suggest an existing custom product for the catalogue later (from edit)
- [ ] Optional: bulk import / quick-add from catalogue

## Phase 4 – Client Side
- [ ] Product search (by name, category, location)
- [ ] Price comparison across providers for the same CatalogItem
- [ ] Distance + estimated travel cost
- [ ] Orders / pickup requests

## Phase 5 – Admin Side
- [x] Admin Dashboard (Basic)
- [x] Admin List Users (Basic)
- [x] Admin List Providers (With Filters)
- [x] Admin review of catalogue requests (approve as new item, link to existing, reject)
- [x] Admin Manage Categories (create, rename, move, reorder; two levels)
- [x] Admin Manage CatalogItems (add / edit / deactivate; unit and category changes update linked products)
- [x] Edit catalogue request details before approving
- [ ] Delete categories (not built: only create / edit / reorder)
- [ ] Seed re-runs overwrite name, unit and category of seeded items; make the seed skip items the admin edited

## Phase 6 – Tunisia Polish
- [ ] i18n (FR + AR)
- [ ] COD / pickup flows
- [ ] Expand catalogue (hardware store, auto/car parts)
- [x] Seed demo providers + sample products with prices (prisma/seed-demo.ts)

---

## Immediate Next Steps

1. Admin: categories management (create / edit / reorder, parent/child) — **current focus**
2. Admin: CatalogItem management (add / edit / deactivate)
3. Provider: product images, quick inline edit of price and stock
4. Client search + comparison

---

## Notes

- Catalogue governance: categories are admin-only. Providers cannot create catalogue items; they
  add a custom product and optionally suggest it. An admin approves it (new item or merged into an
  existing one), which links the product and makes it comparable. Rejected suggestions keep the
  custom listing.

- **Product** = provider’s offer (always has providerId)
- **CatalogItem** = shared identity for comparison (optional on Product)
- A niche item with no `catalogItemId` still works; it just won’t appear in cross-provider comparisons

- Product has a unique (providerId, catalogItemId): a provider lists a catalogue item at most once.
- Linked products inherit unit and category from the CatalogItem (not editable), keeping prices comparable.
