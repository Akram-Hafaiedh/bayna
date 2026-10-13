# Bayna

**Local price comparison + commerce platform for Tunisia**

Bayna helps clients find the best real price for products (including travel cost), and gives local providers a simple dashboard to manage stock, prices, and orders.

**Current focus:** Construction materials (MVP) — expandable to hardware, auto parts, and more  
**Market:** Tunisia  
**Languages (planned):** French + Arabic

---

## Vision

Most price comparison tools only show "cheaper 200 km away".  
Bayna answers the real question:

> “Is it actually worth going there?”

We combine:
- Real local prices + stock
- Distance + estimated travel cost
- Simple ordering (pickup / COD)
- Provider tools for stock & sales management

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
| **Category** | Grouping (Cement, Steel, Bricks, Plumbing, Hardware…) — supports parent/child |
| **CatalogItem** | Shared product identity from the catalogue. Optional. Used for price comparison across providers |
| **Product** | A provider’s offer. Always belongs to one provider. Optional `catalogItemId` |

Rules:
- A product **must** belong to a provider
- `catalogItemId` is **optional** → providers can sell niche items that don’t appear in comparisons
- Multiple providers can link products to the same catalog item → that’s how comparison works
- Sale units: piece, bag, meter, m², m³, ton, roll, liter, other

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
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Fill in DATABASE_URL and AUTH_SECRET

# 3. Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev

# 4. Seed categories + catalogue (construction materials demo)
npm run db:seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed categories + catalog items |

---

## Role System

| Role         | How assigned                                      | Dashboard URL            |
|--------------|---------------------------------------------------|--------------------------|
| **CLIENT**   | Default on registration                           | `/dashboard`             |
| **PROVIDER** | Apply after being CLIENT (+ optional admin approval) | `/provider/dashboard` |
| **ADMIN**    | Manual / promoted only                            | `/admin/dashboard`       |

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

**Next focus: categories management.** An admin area to create, edit and organise
categories (parent/child, display order, French/Arabic names). Catalogue item
management follows, since every catalogue item and product depends on a category.

Provider product management (list with search, filters and pagination; create from the
catalogue or as a custom product; edit and delete) is done. See `TODO.md` for the full
phase-by-phase list.

---

## License

Private — all rights reserved.
