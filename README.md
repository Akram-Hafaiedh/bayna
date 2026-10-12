# Bayna

**Local price comparison + commerce platform for Tunisia**

Bayna helps clients find the best real price for products (including travel cost), and gives local providers a simple dashboard to manage stock, prices, and orders.

**Current focus:** Auto parts (MVP)  
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

## Project Structure

```
app/
├── (auth)/              # Login / Register
├── (public)/            # Landing, search, product pages
├── (client)/            # CLIENT dashboard (/dashboard)
├── (provider)/          # PROVIDER dashboard (/provider/...)
├── (admin)/             # ADMIN dashboard (/admin/...)
├── api/                 # API routes
└── generated/           # Prisma client

components/
lib/
  ├── prisma.ts
  └── session.ts         # getCurrentUser, requireRole helpers
prisma/
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

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

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
- **ADMIN** is never self-assigned
- Never let users freely choose their role on the registration form

---

## Current Status

| Phase | Status |
|-------|--------|
| Phase 0 – Foundation | Done |
| Phase 1 – Core Data Model | Done |
| Phase 2 – Authentication & Roles | In progress |
| Phase 3 – Provider Side | Not started |
| Phase 4 – Client Side | Not started |

See **[TODO.md](./TODO.md)** for the full prioritized checklist.


---

## How to create an Admin

Admins are never self-assigned. Promote a user manually:

```bash
npx prisma studio
```

Or:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```
