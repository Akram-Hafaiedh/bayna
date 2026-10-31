# Bayna

**Local marketplace for Tunisia — with real landed-cost comparison**

Bayna is a marketplace that connects clients with local shops. Buyers discover products, compare real prices (including travel cost), and order for pickup or cash-on-delivery. Shops get a simple dashboard to manage stock, prices, and orders.

Price comparison is a core feature, not the whole product. A pure comparator does not sustain a business; Bayna is built to drive transactions, shop tools, and local commerce.

**Current focus:** Construction materials (MVP) — expandable to hardware, auto parts, and more  
**Market:** Tunisia  
**Languages (planned):** French + Arabic

---

## Vision

Most tools either list prices with no way to buy, or run a marketplace with no honest local comparison.

Bayna does both:

> “Is it actually worth buying from this shop — and can I order it?”

We combine:

- **Marketplace** — shops list stock and prices; clients search, order (pickup / COD)
- **Real landed cost** — price + distance + estimated travel cost, so “cheaper far away” is honest
- **Shared catalogue** — comparable products across shops when it makes sense
- **Shop tools** — stock, pricing, and sales management for local businesses

The business is local commerce (orders, shops, retention). Comparison is how buyers find the best option and why shops want to be listed.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 16 (App Router) + Tailwind  |
| Auth        | NextAuth.js v5 (Credentials)        |
| Database    | PostgreSQL + Prisma 7               |
| Hosting     | Vercel (frontend) + Railway/Supabase (DB) |

---

## Data Model (Products & Catalogue)

| Model | Role |
|-------|------|
| **Category** | Grouping (Cement, Steel, Bricks, Plumbing, Hardware…) — supports parent/child. Shared taxonomy, managed by admin. |
| **CatalogItem** | Shared product identity. Optional on a product. Enables fair comparison across shops when linked. |
| **Product** | A shop’s offer. Always belongs to one shop. Optional `catalogItemId`. |

Rules:

- A product **must** belong to a shop (this is a marketplace listing)
- `catalogItemId` is **optional** → shops can sell niche or custom items that don’t enter cross-shop comparison
- Multiple shops can link products to the same catalog item → that’s how comparison works
- Free-form products still appear in search and can be ordered; they simply don’t show in “compare this exact item” views
- Sale units: piece, bag, meter, m², m³, ton, roll, liter, other

Categories and catalog items are platform-managed so the shared taxonomy stays clean and comparable. Shops are not limited to the catalogue: they can list custom products freely.

---

## Project Structure

```
app/
├── (auth)/              # Login / Register / Forgot-Reset password
├── (public)/            # Landing, search, product pages
├── (account)/           # Profile, Become a Shop
├── (client)/            # CLIENT dashboard (/dashboard)
├── (shop)/              # shop area (/shop/[publicShopId]/...)
├── (admin)/             # ADMIN dashboard (/admin/...)
├── api/                 # API routes
└── generated/           # Prisma client

components/
lib/                     # grouped by domain; the folder says where a rule lives
  ├── prisma.ts          # the database client
  ├── access/            # permissions, roles, teams, guards (requirePlatform / requireShop / requireBusiness)
  ├── audit/             # who did what: actor, withAudit, activity log formatting
  ├── auth/              # sign-in rules, session (getCurrentUser, requireRole), route access, reset tokens
  ├── admin/             # staff, user detail, view-as (impersonation)
  ├── users/             # account status, deletion and erasure, user list and detail
  ├── shops/             # shop input, status, list, paths, products
  ├── businesses/        # business (company) input and choice
  ├── inventory/         # warehouses, stock levels, the movement ledger (only this folder writes Product.stock)
  ├── products/          # product input, status, filters, restore, price review
  ├── catalogue/         # catalogue and category input, units
  ├── plans/             # plans, limits, assignment, prices
  ├── notifications/     # notify() and the notification kinds
  ├── contact/           # the contact form
  ├── rate-limit/        # the rate limiter
  └── shared/            # parsing, geo, slug, time-ago, site facts, legal text, toast
tests/
  ├── unit/              # fast tests, mirror the folders of lib/ (npm run test:unit)
  └── api/               # tests with a real database (npm run test:api)
proxy.ts                 # Route protection (auth + role gates)
prisma/
  ├── schema.prisma
  ├── audit.sql          # audit triggers (added to the baseline migration)
  ├── sql/               # other SQL Prisma cannot express (inventory.sql: constraints, append-only ledger); added to the baseline and to the migration that creates those tables
  ├── seed/              # Main seeder (index.ts) + one seeder per kind of data (one file per seeder in seeders/, each with its own data)
  └── migrations/
types/
```

---

## Getting Started

```bash
# Install
npm install

# Env
cp env.example .env
# Set DATABASE_URL, AUTH_SECRET, etc.

# DB
npx prisma migrate dev
npm run seed                    # everything: platform roles, categories, catalogue, demo companies,
                                # shops, roles, products and test accounts (dev only)
npm run seed -- --list          # the seeders, in running order
npm run seed products           # one seeder, plus the ones it needs (add -- --exact for only that one)
npm run seed categories catalogue   # just the shared catalogue

# Dev
npm run dev
```

---

## Roles

| Role         | How you get it                                      | Dashboard URL            |
|--------------|-----------------------------------------------------|--------------------------|
| **CLIENT**   | Default on registration                             | `/dashboard`             |
| **COMPANY** | Apply after being CLIENT (+ optional admin approval)| `/shop` (opens your shop) |
| **ADMIN**    | Manual / promoted only                              | `/admin/dashboard`       |

**Rules:**

- Every new user is created as **CLIENT** by default
- Users can later apply to become a **COMPANY** (separate flow)
- **ADMIN** is never self-assigned from the public UI

### How to make a user ADMIN

```bash
npx prisma studio
# Open User table → set role = ADMIN
```

Or SQL:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

---

## Route Protection

Protected routes are enforced in `proxy.ts` (Next.js proxy / middleware style):

- `/admin/*` → ADMIN only
- `/shop/*` → COMPANY only (the shop in the address must be one you work in, else 404)
- `/dashboard` → CLIENT only
- `/profile`, `/become-shop` → any authenticated user

Unauthenticated users are redirected to `/login`. Wrong-role users are redirected to their home dashboard.

---

## Catalogue (Demo Seed)

The seed script loads **16 categories** and ~**200 catalog items** based on a Tunisian construction materials demo catalogue:

1. Cement, Concrete & Binders  
2. Reinforcing Steel & Metal Products  
3. Bricks, Blocks & Masonry  
4. Sand, Gravel & Aggregates  
5. Waterproofing & Insulation  
6. Plasterboard, Boards & Suspended Ceilings  
7. Tiles & Coverings  
8. Paint & Decoration  
9. Plumbing & Sanitary  
10. Electrical  
11. Doors, Windows & Joinery  
12. Wood & Site Carpentry  
13. Tools & Site Equipment  
14. Fixings & Hardware  
15. Roofing, Façade & Exterior  
16. Garden & Outdoor Landscaping  

No prices are seeded — shops set their own prices when creating products. Categories for **hardware store items** and **auto/car parts** can be added later the same way.

---

## Roadmap

**Done:** shared catalogue and categories with admin management; shop product management (list with
search, filters and pagination, create from the catalogue or as a custom product, edit, delete); admin
review of catalogue requests; audit columns and an append-only activity log on every table; a
permission layer (roles and assignments, one guard for every admin and shop API route).

**Also done and verified:** the shop profile (shop identity, contact, map pin) with admin review of
edits to a verified shop's name and location, edit / withdraw for pending applications, and
notifications (a bell in the header, so a shop learns when its changes are reviewed or its application is
decided).

**Roadmap** (seven releases, each ending with a test and click-through gate; details in `TODO.md`, "Next up"):
R1 clean base (quick fixes, catalogue unit-change guard, product soft delete, inline price and stock edit);
R2 shops, people and plans (shop switcher and create shop, real email, team and invites, free tier plus
subscriptions); R3 stock and prices (several warehouses with stock movements and low-stock alerts, custom
taxes with the price entered before tax and shown with tax); R4 the client side (search, comparison,
distance, public shop pages); R5 orders; R6 security and support (2FA, sessions, support module,
impersonation); R7 billing, analytics and reviews. Product images are deferred until a storage service is
chosen.

**Backlog (not started):** richer account and security pages (2FA, sessions, connected accounts), person and admin detail profiles, inventory with a stock ledger and reorder queue,
personal versus business clients with invoices, shop and client team pages, analytics and reports,
promotions and reviews, a help and support module, an admin project / deal board, and admin billing.

Longer term: client search and ordering, distance + travel cost, COD/pickup flows, i18n (FR + AR), and
expanding the catalogue beyond construction materials and auto parts.

The full phase-by-phase list, with the backlog ideas and their open questions, is in `TODO.md`.

---

## License

Private — all rights reserved.
