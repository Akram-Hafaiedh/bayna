# Access control, audit, impersonation and support

Design notes behind `TODO.md` (Phase 7, Phase 8 and the provider profile in Phase 3a).
Goal: add these once, at the data-model level, so the `User` table and the guards never have to be
reworked when new modules arrive.

Status: sections 1 (core) and 2 are built; the rest is design only. Built so far: the audit columns and
triggers (section 2), and the access tables, permission catalogue, evaluator, system roles and guard
(section 1: `lib/access/`, `prisma/schema.prisma`, `scripts/sync-access.ts`). Not built: role and
assignment management screens, step-up checks, impersonation (3), support (4), the provider profile (5).
Items marked **verify** depend on behaviour I could not test.

---

## 1. Access control

### 1.1 Model

```
User ──< AccessAssignment >── Role ──< permission keys (strings)
              │
              ├─ scope        PLATFORM | SHOP
              ├─ providerId   null for PLATFORM, the shop for SHOP
              ├─ status       INVITED | ACTIVE | SUSPENDED
              ├─ grants[]     extra permission keys for this person
              ├─ denies[]     keys removed for this person
              └─ expiresAt    optional (temporary staff, time-boxed support access)

Role:  id, scope, providerId (null = system role), key, name, description,
       isSystem, permissions String[]
```

- A user can hold several assignments (a platform support agent who also owns a shop; a person
  working for two shops). The UI can start with one shop per user without changing the schema.
- `Provider.userId` stays as "the applicant / original owner" and is migrated to an OWNER assignment.
- Clients need no assignment. Client abilities are self-service and enforced by ownership.
- The global `User.role` (CLIENT / PROVIDER / ADMIN) stays **only for routing** (which dashboard to
  open). Authorization never reads it.
- `Role.providerId` is nullable from day one so shops can have custom roles later without a schema
  change. System roles are locked; to customise, copy one.

**Built:** `AccessRole` and `AccessAssignment` (plain `providerId` on the role, real foreign keys on the
assignment so deleting a user or shop removes its assignments). Two choices made while building:
a check that names a shop looks only at that shop's assignments and a check without one looks only at
platform assignments, so the same key (`order.request.view_all`) can mean different things in the two
scopes; and system roles are stored as explicit key lists (only SUPER_ADMIN stores `*`), so a key added
to the catalogue later never reaches an existing role by itself. There is no cross-request cache and no
`sessionVersion` yet: access is read from the database on every request, so changes apply at once.

### 1.2 Permission keys

Typed constants in code are the single source of truth. Format: `module.resource.action`.
Roles store plain strings. A test fails if a stored key is not in the catalogue or if an API route
has no guard.

Rules:

1. Default deny.
2. Resolution: role permissions + `grants` − `denies`. Deny wins.
3. Computed per request with a short cache keyed by user and a `sessionVersion`. Changing a role or
   assignment bumps the version, so access changes apply immediately. The JWT carries identity
   only. This also removes today's per-request role query in the JWT callback.
4. Narrow variants are separate keys (`order.request.view_assigned` vs `view_all`), so "staff sees
   only their own orders" needs no special code.
5. Wildcard `*` exists only on SUPER_ADMIN.
6. No privilege escalation: nobody can grant or assign a key they do not hold themselves.
7. Protected: the last OWNER of a shop and the last SUPER_ADMIN cannot be removed, suspended or
   demoted.
8. Sensitive actions need a recent password check (step-up): role changes, ownership transfer,
   impersonation, data export.
9. New permissions are added to roles through a migration or seed with an explicit mapping. They are
   never auto-granted to existing roles.

### 1.3 Catalogue: shop scope

| Module.resource | Actions |
|---|---|
| `shop.profile` | view, edit, edit_legal |
| `shop.hours` | edit |
| `shop.media` | manage |
| `shop.fulfilment` | edit (pickup, delivery, COD) |
| `shop.delivery_zone` | manage |
| `shop.status` | close_temporarily, reopen |
| `shop.closure` | request |
| `product.listing` | view, create, edit, archive, restore, delete, publish |
| `product.price` | edit, view_history |
| `product.stock` | edit, view_history |
| `product.image` | manage |
| `product.bulk` | edit, import, export |
| `product.suggestion` | create |
| `pricing.tier` | manage |
| `pricing.promotion` | manage |
| `pricing.tax` | manage |
| `pricing.delivery_fee` | manage |
| `inventory.location` | manage |
| `inventory.adjustment` | create |
| `order.request` | view_assigned, view_all, accept, reject, update_status, cancel, assign, refund, export |
| `order.note` | create |
| `order.message` | send |
| `customer.contact` | view, message |
| `team.member` | view, invite, update_role, suspend, remove, transfer_ownership |
| `team.role` | view, manage |
| `activity.log` | view, export |
| `insight.dashboard` | view |
| `insight.report` | export |
| `billing.subscription` | view, manage |
| `billing.invoice` | view |
| `support.ticket` | create, view_shop, comment |
| `feedback.request` | create, vote, comment |
| `notification.settings` | manage |
| `integration.api_key` | manage |
| `integration.webhook` | manage |
| `review.rating` | view, reply |

### 1.4 Catalogue: platform scope

| Module.resource | Actions |
|---|---|
| `user.account` | view, create, update, suspend, reinstate, delete, restore, export |
| `user.credential` | reset_password, revoke_sessions, force_logout |
| `shop.application` | view, approve, reject, request_changes |
| `shop.provider` | view, update, verify, suspend, reinstate, delete, restore |
| `catalog.item` | view, create, update, archive, merge, import, export |
| `catalog.category` | view, create, update, archive, reorder |
| `catalog.suggestion` | view, review |
| `product.listing` | view_all, hide, delete |
| `product.moderation` | manage |
| `order.request` | view_all, intervene, cancel, refund |
| `order.dispute` | view, manage, resolve |
| `support.ticket` | view_all, assign, reply, note_internal, change_status, change_priority, merge, delete, escalate, export, reopen |
| `support.canned_reply` | manage |
| `support.sla` | manage |
| `feedback.request` | view_all, triage, merge, change_status, comment, publish_roadmap, delete |
| `content.page` | manage (landing page, FAQ, legal pages, announcements) |
| `settings.platform` | view, update (fees, per-km rate, maintenance mode) |
| `settings.feature_flag` | manage |
| `access.role` | view, create, update, delete |
| `access.assignment` | view, grant, revoke |
| `audit.log` | view, export |
| `audit.impersonation` | view |
| `impersonation.session` | start_readonly, start_write, end_any, view |
| `finance.commission` | view, manage |
| `finance.payout` | view, manage |
| `analytics.dashboard` | view |
| `analytics.report` | export |
| `notification.broadcast` | send |
| `privacy.request` | view, fulfil_export, fulfil_erasure |
| `system.health` | view |
| `system.job` | view, run |

### 1.5 Catalogue: client scope (self-service, no role needed)

| Module.resource | Actions |
|---|---|
| `account.profile` | view, update |
| `account.password` | change |
| `account.session` | view, revoke |
| `account.activity` | view |
| `account.data` | export, request_erasure |
| `shop.application` | submit, edit_pending, withdraw |
| `estimate.cart` | manage |
| `order.request` | create, view_own, cancel_own |
| `review.rating` | create |
| `support.ticket` | create, view_own, comment, close_own |
| `feedback.request` | create, vote, comment |
| `notification.settings` | manage_own |

### 1.6 System roles (seeded)

Platform:

| Role | Holds |
|---|---|
| SUPER_ADMIN | `*`. Protected; only another super admin can assign it |
| ADMIN | Everything except `access.*`, `impersonation.session.start_write` and `system.job.run` |
| SUPPORT_AGENT | Ticket and feedback handling (no delete or merge), read access to users, shops and orders, `impersonation.session.start_readonly` |
| SUPPORT_LEAD | Agent + assign, merge, escalate, export, canned replies, SLA |
| CATALOGUE_MANAGER | `catalog.*`, `product.listing.view_all` |
| MODERATOR | `shop.application.*`, `shop.provider.*`, `product.moderation.*`, `order.dispute.*` |
| FINANCE | `finance.*`, `order.request.view_all`, `analytics.*` |
| AUDITOR | Read-only: `audit.*`, `access.*.view`, user and shop views |

Shop:

| Role | Holds |
|---|---|
| OWNER | Everything for the shop. Protected |
| MANAGER | Everything except `team.member.transfer_ownership`, `billing.subscription.manage`, `shop.profile.edit_legal`, `integration.*` |
| ORDER_HANDLER | Order requests (view, accept, reject, update status, cancel), notes, client messages, `customer.contact.view`, product view |
| INVENTORY_CLERK | Listing create / edit, stock, images, inventory, bulk import. **No** `product.price.edit` |
| ACCOUNTANT | Order view and export, billing view, insights and reports, tax settings |
| VIEWER | Read-only on the shop |

Open question from the old TODO, answered by default: only OWNER and MANAGER hold
`product.price.edit`.

---

## 2. Audit columns and timelines

### 2.1 Columns on every table

`createdAt`, `updatedAt`, `createdById`, `updatedById`. The two `...ById` columns are plain ids with
no foreign key (see Cautions).

**Built (columns: `20261015113316_audit_foundation`; triggers: `20261015115650_audit_triggers`):** all four columns exist on every model.
`Account`, `Session` and `VerificationToken` gained `createdAt` / `updatedAt`; `PasswordResetToken`
and `LoginSession` gained `updatedAt`; every model gained the two actor columns.

Soft delete (`deletedAt`, `deletedById`) exists on `User`, `Provider`, `Product`, `CatalogItem` and
`Category`, and will be added to orders and tickets later. **Nothing filters on it yet** and routes
still hard-delete, so no behaviour changed. Turning it on is a separate task (3b).

Actor meaning:

- `createdById` / `updatedById` is always the **real person** who acted. During impersonation that
  is the admin, never the viewed user.
- System writes (seed, import, jobs, webhooks) leave the id null and record `source` in
  `ActivityLog`.
- The auth adapter creates `Account`, `Session` and `VerificationToken` rows without an actor. That is
  fine; the columns are nullable.

Cautions:

- **Soft delete and unique constraints.** `Product (providerId, catalogItemId)` and the unique slugs
  would block re-creating something that was soft-deleted. Use partial unique indexes
  (`WHERE "deletedAt" IS NULL`) written in raw SQL inside the migration, since Prisma cannot express
  them.
- **No foreign keys on the actor columns (decided 15 Oct 2026).** A foreign key adds two relation
  fields to `User` for every table, so adding a table would mean editing `User` again. Plain ids avoid
  that, and `ActivityLog` stores the actor's name at write time so names survive deletion. The cost:
  the database does not check that the id exists, and there is no `include: { updatedBy }`. Resolve
  names with one batched lookup.
- **User fields (built):** `status` (ACTIVE, SUSPENDED, BANNED, PENDING_DELETION), `suspendedReason`,
  `lastLoginAt`, `locale`, `timezone`, `preferences Json`, `deletedAt`, `deletedById`. **`status` is
  not enforced yet:** setting a user to SUSPENDED changes nothing until the permission guard (Phase 7,
  permissions) refuses non-ACTIVE users. Nothing writes `lastLoginAt` yet either.

### 2.2 Stamping the actor automatically

**Decided and built: database triggers, not a Prisma extension.** A Prisma extension only sees
top-level calls, so nested writes (a product created together with its suggestion) and raw SQL would
escape it. Triggers see every row change, including `updateMany`, cascaded deletes and seeds, and they
can be tested for real against Postgres.

How it works:

1. `audit_stamp` (BEFORE INSERT / UPDATE) sets `createdById`, `updatedById` and `updatedAt`, and
   keeps `createdAt` / `createdById` from being changed. The values come from the transaction setting
   `app.audit`. With no actor, `updatedById` becomes null instead of keeping a stale person.
2. `audit_log` (AFTER INSERT / UPDATE / DELETE) writes one `ActivityLog` row with field-level
   before / after values. It writes nothing when only ignored columns changed (for example
   `lastLoginAt`, `lastActiveAt`) and redacts secrets (`password`, tokens).
3. The app says who is acting once per transaction with `withAudit(actor, tx => ...)`
   (`lib/audit/run.ts`). Writes outside it are still stamped and logged, with no actor and source
   `SYSTEM`, so a missing call shows up as a gap and is never silent.
4. New tables call `SELECT audit_attach('TableName');` in the migration that creates them.
   `Session` and `VerificationToken` are stamped but not logged (they hold secrets and are unused
   with JWT sessions).

Tests (all run, see the verification note in `TODO.md`):

- `prisma/tests/audit-foundation.sql`: 36 checks on a real database (stamping, exact diffs, no-op
  updates, `updateMany`, redaction, soft delete, cascades, append-only guard, UTC timestamps, a
  malformed context, and that every table has the columns and triggers). Rolls back; leaves no data.
- `lib/audit/actor.test.ts`: unit tests, including one that checks the JSON keys the app writes are
  the keys the trigger reads.
- `scripts/check-audit-schema.ts`: fails when a model in `schema.prisma` lacks the four columns.

**Not done yet:** existing routes still call `prisma.*` directly, so their rows are logged with no
actor. Wiring them to `withAudit` happens together with the permission guard, because that rewrite
touches every route anyway and the guard is what knows the actor.

**Known limits:** a trigger cannot know which user acted, only what the app told it. A pooled
connection could in theory carry a stale `app.audit`; that is why the setting is transaction-local
(`set_config(..., true)`) and `withAudit` always runs inside a transaction.

### 2.3 `ActivityLog`

Append-only. Written in the same transaction as the change. **Built** (table, indexes, triggers).
Events that are not row changes (logins, impersonation, permission changes) use `logActivity()`.

| Field | Notes |
|---|---|
| `id`, `createdAt` | |
| `entityType`, `entityId` | what changed (any table, users included) |
| `providerId` | null for platform-level entities; powers the shop activity feed |
| `action` | From triggers: CREATE, UPDATE, DELETE, SOFT_DELETE, RESTORE. From `logActivity()`: LOGIN, PASSWORD_RESET_REQUESTED, ROLE_CHANGE, IMPERSONATION_START, ... (free text, so new modules need no migration) |
| `changes` | JSON list of `{ field, from, to }` |
| `actorId` + snapshots | `actorName`, `actorRole` copied at write time so history survives deletion or anonymisation |
| `onBehalfOfId` | the user who was being impersonated, if any |
| `impersonationId` | link to the session |
| `source` | WEB, API, SEED, JOB, IMPORT, WEBHOOK, SYSTEM (default when no actor context was set) |
| `requestId`, `ip`, `userAgent` | |
| `note` | optional reason |

Rules:

- Secrets are redacted before storing: `password`, any `*token*`, `refresh_token`, `id_token`.
- The app never updates or deletes rows. A trigger enforces it (UPDATE, DELETE and TRUNCATE raise an
  error). A retention or erasure job can lift the guard for one transaction with
  `SELECT set_config('app.audit_maintenance', 'on', true)`.
- Indexes: `(entityType, entityId, createdAt)`, `(providerId, createdAt)`, `(actorId, createdAt)`.
- Retention and erasure: on erasure requests anonymise the snapshot fields rather than delete rows.
  Confirm the retention period and erasure rules with a lawyer for Tunisia.

### 2.4 One Timeline component, four places

1. Entity history tab (product, provider, user, order, ticket)
2. Shop activity page for owner and manager (filter by member and entity)
3. Admin global audit view
4. "My account activity" for every user (logins, password and role changes, support access)

---

## 3. Super admin "view as"

Purpose: debugging and checking that features work from a user's point of view.

### 3.1 Model

`ImpersonationSession`: `id`, `adminId`, `targetUserId`, `mode` (READ_ONLY | WRITE), `reason`,
`ticketId?`, `startedAt`, `expiresAt`, `endedAt`, `endedBy`, `ip`, `userAgent`.

### 3.2 Behaviour

- Start needs `impersonation.session.start_readonly` (or `start_write`), a written reason, a recent
  password check, and 2FA (Phase 2 item).
- Entry points: user row, shop page, order, support ticket.
- Cannot target yourself or any account holding a platform assignment.
- One active session per admin. Default expiry 30 minutes, hard cap 2 hours.
- A banner is always visible with the target name, time left and an Exit button.
- **READ_ONLY (default):** every write is rejected by the guard.
- **WRITE:** separate permission, for reproducing a bug. Each write is logged.
- Always blocked, in both modes: changing email, password or 2FA; revoking the target's sessions;
  payouts; account deletion; accepting terms; placing orders or payments as the user.
- No `LoginSession` is created for the target and their `lastActiveAt` is not touched.

### 3.3 Attribution

Two identities per request:

- `getActor()` is the real admin. Used for audit columns and `ActivityLog.actorId`.
- `getSubject()` is the viewed user. Used for data scoping and `can()` checks.

Every log row written while impersonating carries `onBehalfOfId` and `impersonationId`. The target
sees "support accessed your account" in their own activity (recommended; optional email too). Admins
with `audit.impersonation.view` see every session.

### 3.4 Also useful for debugging permissions

An "explain" tool: pick a user and a key, see allowed or denied and why (role, grant, deny,
expired, suspended). A role preview page lists what a role can do.

---

## 4. Support module

### 4.1 Tickets (problems)

`SupportTicket`

- `number` (human id such as `BYN-0042`, from a database sequence)
- `requesterId`, `providerId?` (when raised for a shop)
- `category`: ACCOUNT, SHOP_APPLICATION, CATALOGUE, PRODUCT, ORDER, PAYMENT, BUG, OTHER
- `priority`: LOW, NORMAL, HIGH, URGENT
- `status`: OPEN, IN_PROGRESS, WAITING_ON_USER, RESOLVED, CLOSED
- `assigneeId`, `subject`, `description`
- link to an entity (`entityType`, `entityId`: order, product, shop)
- `context` JSON captured automatically: page URL, role, browser, shop, app version
- `firstResponseAt`, `resolvedAt`, `dueAt`, satisfaction rating + comment

`SupportMessage`: `ticketId`, `authorId`, `body`, `isInternal` (staff-only notes), attachments.
Status and assignment changes go to `ActivityLog`, which gives the ticket timeline for free.

Behaviour:

- A "Report a problem" entry in the navbar and on error pages pre-fills the context.
- **People who cannot log in** (the login or reset flow is the problem) need a public contact form
  with email verification and rate limiting. Without it, the people with the worst problems cannot
  reach support.
- Requester sees public messages only. Shop tickets are visible to members with
  `support.ticket.view_shop`.
- Agents: inbox with filters, assignment, canned replies, internal notes, merge duplicates,
  escalate. "View as requester" from the ticket opens a read-only impersonation linked to it.
- Auto-close after N days in WAITING_ON_USER. SLA timers need a scheduled job.
- Spam limits: per-user rate limit and a cap on open tickets.

### 4.2 Feature requests and recommendations

Separate from tickets because the workflow differs.

- `FeatureRequest`: `title`, `description`, `kind` (FEATURE, IMPROVEMENT, OTHER), `status`
  (NEW, UNDER_REVIEW, PLANNED, IN_PROGRESS, SHIPPED, DECLINED, DUPLICATE), `authorId`,
  `providerId?`, `duplicateOfId?`, `voteCount`, `publicNote`
- `FeatureVote`: unique (`requestId`, `userId`)
- `FeatureComment`
- Duplicate suggestions while typing (Postgres `pg_trgm` similarity: **verify** it is available on the
  chosen host)
- Admin triage, merge of duplicates, optional moderation before a request is public
- Public roadmap / changelog page built from statuses

### 4.3 Shared infrastructure the support module needs

- Real email sending (reset links are only logged today)
- In-app notification centre (`Notification`: user, type, title, body, href, `readAt`). Built 16 Oct 2026 (TODO Phase 7b): stamped by `audit_stamp` but with no `audit_log` trigger, because the event that causes a notification is already in `ActivityLog` and a read is not an auditable change
- File storage and a generic `Attachment` table (also needed for product images; pick the provider
  once)
- A scheduled-jobs mechanism (SLA, auto-close, digests)

### 4.4 Metrics

First response time, time to resolution, open tickets by category, requests by status.

---

## 5. Provider profile (Phase 3a, the next task)

Built after the Phase 7 foundation (decided 15 Oct 2026), so it uses the real guard and the real
audit columns from the start.

### 5.1 Findings from the current code

- The only code that updates a `Provider` is the admin approval route.
- `POST /api/shop/apply` creates the profile once; there is no edit or withdraw.
- `/shop/*` is gated on the global `PROVIDER` role, and a pending applicant is still a CLIENT.
  So editing a **pending** application has to live under `/become-provider`, not `/provider`.
- Latitude and longitude exist in the schema but nothing sets them (only the demo seed). The apply
  form collects city and governorate as free text.
- The reject route deletes the `Provider` row, which destroys the profile and all its history.

### 5.2 Scope

| Piece | Detail |
|---|---|
| Page | `/shop/<publicShopId>/profile`: Identity, Contact, Location sections; verification badge; read-only when the member lacks `shop.profile.edit` |
| API | `GET` / `PATCH /api/shop/profile`, validated in a new `lib/provider-input.ts` in the style of `lib/product-input.ts` |
| Pending applicants | `PATCH` and `DELETE` on `/api/shop/apply` to edit or withdraw while pending, plus the matching UI in `/become-provider` |
| Fields | businessName, description, phone, address, city, governorate, latitude, longitude, plus new columns `whatsapp`, `locationSource`, `needsReview` |
| Location | Decided 16 Oct 2026: the provider sets his own location with a map pin (click or drag), starting from the governorate centre or an address search. `locationSource` (LOOKUP, PIN, GEOCODED) records how it was set, so a pin the provider placed is trusted over a guess. The 24 governorates are a TypeScript constant (`lib/governorates.ts`, not a database table) with coordinates from a cited source. A pin must lie inside Tunisia and within 250 km of its governorate centre; shops saved before the map existed (coordinates, no `locationSource`) are shown as IMPORTED. The same map component later shows all shops on the public pages (Phase 4) |
| Audit | Uses the Phase 7 audit columns and `ActivityLog`; writes a before / after entry in the same transaction |
| Guard | `requirePermission("shop.profile.edit")` |

Validation:

- businessName 2 to 120 characters, required; city required
- description up to 2000, address up to 200
- phone and WhatsApp: Tunisian numbers (`+216` followed by 8 digits, spaces allowed); normalise on save
- governorate must come from the lookup list (the 24 governorates, with French and Arabic names and
  a centre point; fill the coordinates from a reliable source)

### 5.3 Decided: editing a verified shop

Decided on 15 Oct 2026:

- phone, WhatsApp, description: save and log only
- businessName, address, city, governorate and location: save, log, and set `needsReview` so an admin
  sees it in the providers list. The shop stays live and the change is not blocked

Not chosen: blocking these edits until an admin re-approves (safer, but slows every shop down).

### 5.4 Not in this task

Opening hours, logo, delivery and pickup options, shop states, public shop page, several locations
per shop. They stay in 3a "optional later" and 3e.

### 5.5 Tests

Unit tests run on Vitest (adopted 16 Oct 2026, replacing Node's built-in runner): `npm run test:unit`.
This task adds unit tests for `lib/provider-input.ts` and the governorate lookup.
