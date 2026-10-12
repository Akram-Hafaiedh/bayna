# Bayna – Project TODOs

Last updated: 12 Oct 2026

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

## Phase 2 – Auth ( Mostly done )
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
- [ ] Optional: middleware protection
- [ ] Enrich LoginSession with real userAgent / IP on login
- [ ] Google / Facebook OAuth

## Phase 3 – Provider Side
- [x] “Become a Provider” application flow (pending until admin approves)
- [ ] Provider profile CRUD
- [ ] Product management (add / edit / delete / stock)

## Phase 4 – Client Side
- [ ] Product search + comparison (price + distance)
- [ ] Orders / pickup requests

## Phase 5 – Admin Side
- [x] Admin Dashboard (Basic)
- [x] Admin List Users (Basic)
- [x] Admin List Providers (With Filters)
- [ ] Admin Manage Categories

## Phase 6 – Tunisia Polish
- [ ] i18n (FR + AR), COD, seed data

---

## Immediate Next Steps

1. Run migration for LoginSession + passwordChangedAt
2. Test profile + change password + revoke sessions
3. Become a Provider flow
4. Product management
