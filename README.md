# Bayna

**Local marketplace for Tunisia — with real landed-cost comparison**

Bayna is a marketplace that connects clients with local providers. Buyers discover products, compare real prices (including travel cost), and order for pickup or cash-on-delivery. Providers get a simple dashboard to manage stock, prices, and orders.

Price comparison is a core feature, not the whole product. A pure comparator does not sustain a business; Bayna is built to drive transactions, provider tools, and local commerce.

**Current focus:** Construction materials (MVP) — expandable to hardware, auto parts, and more  
**Market:** Tunisia  
**Languages (planned):** French + Arabic

---

## Vision

Most tools either list prices with no way to buy, or run a marketplace with no honest local comparison.

Bayna does both:

> “Is it actually worth buying from this provider — and can I order it?”

We combine:

- **Marketplace** — providers list stock and prices; clients search, order (pickup / COD)
- **Real landed cost** — price + distance + estimated travel cost, so “cheaper far away” is honest
- **Shared catalogue** — comparable products across providers when it makes sense
- **Provider tools** — stock, pricing, and sales management for local businesses

The business is local commerce (orders, providers, retention). Comparison is how buyers find the best option and why providers want to be listed.

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
| **CatalogItem** | Shared product identity. Optional on a product. Enables fair comparison across providers when linked. |
| **Product** | A provider’s offer. Always belongs to one provider. Optional `catalogItemId`. |

Rules:

- A product **must** belong to a provider (this is a marketplace listing)
- `catalogItemId` is **optional** → providers can sell niche or custom items that don’t enter cross-provider comparison
- Multiple providers can link products to the same catalog item → that’s how comparison works
- Free-form products still appear in search and can be ordered; they simply don’t show in “compare this exact item” views
- Sale units: piece, bag, meter, m², m³, ton, roll, liter, other

Categories and catalog items are platform-managed so the shared taxonomy stays clean and comparable. Providers are not limited to the catalogue: they can list custom products freely.

---

## Project Structure

```
app/
├── (auth)/              # Login / Register / Forgot-Reset password
├── (public)/            # Landing, search, product pages
├── (account)/           # Profile, Become a Provider
├── (client)/            # CLIENT dashboard (/dashboard)
├── (provider)/          # PROVIDER dashboard (/provider/...)
├── (admin)/             # ADMIN dashboard (/admin/...)
├── api/                 # API routes
└── generated/           # Prisma client

components/
lib/
  ├── prisma.ts
  └── session.ts         # getCurrentUser, requireAuth, requireRole
proxy.ts                 # Route protection (auth + role gates)
prisma/
  ├── schema.prisma
  ├── seed.ts            # Categories + ~200 catalog items
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
npx tsx prisma/seed.ts          # shared catalogue
npx tsx prisma/seed-demo.ts     # optional demo providers + products

# Dev
npm run dev
```

---

## Roles

| Role         | How you get it                                      | Dashboard URL            |
|--------------|-----------------------------------------------------|--------------------------|
| **CLIENT**   | Default on registration                             | `/dashboard`             |
| **PROVIDER** | Apply after being CLIENT (+ optional admin approval)| `/provider/dashboard`    |
| **ADMIN**    | Manual / promoted only                              | `/admin/dashboard`       |

**Rules:**

- Every new user is created as **CLIENT** by default
- Users can later apply to become a **PROVIDER** (separate flow)
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
- `/provider/*` → PROVIDER only
- `/dashboard` → CLIENT only
- `/profile`, `/become-provider` → any authenticated user

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

No prices are seeded — providers set their own prices when creating products. Categories for **hardware store items** and **auto/car parts** can be added later the same way.

---

## Roadmap

**Next focus: categories management.** An admin area to create, edit and organise categories (parent/child, display order, French/Arabic names). Catalogue item management follows, since every catalogue item and product depends on a category.

Provider product management (list with search, filters and pagination; create from the catalogue or as a custom product; edit and delete) is done. See `TODO.md` for the full phase-by-phase list.

Longer term: client search & ordering, distance + travel cost, COD/pickup flows, i18n (FR + AR), and expanding the catalogue beyond construction materials.

---

## License

Private — all rights reserved.
