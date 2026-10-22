// prisma/seed/seeders/users.ts
// Test accounts with a known password, to try roles, permissions, the team page and invite links: the data
// (people with different roles in the demo companies, people with no access, and invitations in every state)
// and the seeder. Role names must match a default role of the company or shop (seed.test.ts checks it).
// Safe to run again: accounts, access and invitations are matched and updated, never duplicated, and every
// invite keeps the same link.
import { createHash } from "node:crypto"
import bcrypt from "bcryptjs"
import { SEED_PASSWORD, SeedError, type Seeder } from "../core"

export const TEST_DOMAIN = "team.bayna.test"
export const testEmail = (local: string) => `${local}@${TEST_DOMAIN}`

// Company and shop names, as created by the businesses and shops seeders
export const COMPANY_NAMES = {
    carthage: "Demo - Carthage Group SARL",
    sfax: "Demo - Sfax BTP SUARL",
} as const
export const SHOP_NAMES = {
    tunis: "Demo - Carthage Materials",
    marsa: "Demo - Carthage Materials La Marsa",
    sfax: "Demo - Sfax BTP Centre",
} as const

export type Place =
    | { level: "BUSINESS"; business: keyof typeof COMPANY_NAMES }
    | { level: "SHOP"; shop: keyof typeof SHOP_NAMES }

export type Grant = {
    place: Place
    role: string
    status?: "ACTIVE" | "SUSPENDED"
    /** days from now; negative = already over */
    expiresInDays?: number
}

export type Person = {
    local: string
    name: string
    /** what they are here to test */
    note: string
    /** a platform role makes the account an admin */
    platformRole?: string
    grants: Grant[]
}

export const PEOPLE: Person[] = [
    // ---- Business level (reach every shop of the business) ---------------------------------
    { local: "business-accountant", name: "Test Business Accountant", note: "Business role: sees money, not the team", grants: [{ place: { level: "BUSINESS", business: "carthage" }, role: "Business accountant" }] },
    { local: "business-hr", name: "Test Business HR", note: "Business role: manages the team of every shop", grants: [{ place: { level: "BUSINESS", business: "carthage" }, role: "HR" }] },
    { local: "operations", name: "Test Operations", note: "Business role: works in every shop", grants: [{ place: { level: "BUSINESS", business: "carthage" }, role: "Operations" }] },

    // ---- Shop level ----------------------------------------------------------------------------
    { local: "manager-tunis", name: "Test Manager Tunis", note: "Manager of the Tunis shop only: must not reach La Marsa or the business area", grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Manager" }] },
    { local: "manager-marsa", name: "Test Manager La Marsa", note: "Manager of the La Marsa shop only", grants: [{ place: { level: "SHOP", shop: "marsa" }, role: "Manager" }] },
    { local: "orders", name: "Test Order Handler", note: "Order handler in the Tunis shop: orders yes, products, team and profile no", grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Order handler" }] },
    { local: "inventory", name: "Test Inventory Clerk", note: "Inventory clerk in the Tunis shop: products and stock, nothing about team or money", grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Inventory clerk" }] },
    {
        local: "viewer", name: "Test Viewer", note: "Viewer in both shops of the company (shop switcher with two shops): every create, edit and delete must be refused",
        grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Viewer" }, { place: { level: "SHOP", shop: "marsa" }, role: "Viewer" }],
    },

    // ---- Edge cases ------------------------------------------------------------------------------
    { local: "suspended", name: "Test Suspended", note: "Manager whose access is suspended: cannot open the shop", grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Manager", status: "SUSPENDED" }] },
    { local: "expiring", name: "Test Expiring", note: "Viewer whose access ends in 3 days", grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Viewer", expiresInDays: 3 }] },
    { local: "expired", name: "Test Expired", note: "Viewer whose access ended yesterday: has no access any more", grants: [{ place: { level: "SHOP", shop: "tunis" }, role: "Viewer", expiresInDays: -1 }] },
    {
        local: "multi", name: "Test Multi Business", note: "Accountant of one business and manager of a shop in another (business picker, grouped shop switcher)",
        grants: [{ place: { level: "BUSINESS", business: "carthage" }, role: "Business accountant" }, { place: { level: "SHOP", shop: "sfax" }, role: "Manager" }],
    },

    // ---- Platform (admin area) -----------------------------------------------------------------
    { local: "admin", name: "Test Admin", note: "Platform role Super admin: the whole admin area", platformRole: "Super admin", grants: [] },
    { local: "support", name: "Test Support Agent", note: "Platform role Support agent: admin area, but only what a support agent may do", platformRole: "Support agent", grants: [] },
    { local: "moderator", name: "Test Moderator", note: "Platform role Moderator", platformRole: "Moderator", grants: [] },

    // ---- People with no access ----------------------------------------------------------------
    { local: "invitee", name: "Test Invitee", note: "Has an account and no access. Open the invite links below while logged in as this user", grants: [] },
    { local: "nobody", name: "Test Nobody", note: "Has an account, no access and no invitation: invite this email yourself from Team, or use it for the wrong-account test", grants: [] },
    { local: "client", name: "Test Client", note: "A plain client: /provider and /business must send this account away", grants: [] },
]

export type InviteSeed = {
    /** Stable name: the link is derived from it, so the same invite keeps the same link on every run */
    label: string
    to: string
    place: Place
    role: string
    state: "pending" | "expired" | "revoked"
    note: string
}

export const INVITES: InviteSeed[] = [
    { label: "shop-manager", to: testEmail("invitee"), place: { level: "SHOP", shop: "tunis" }, role: "Manager", state: "pending", note: "existing account, shop invite" },
    { label: "business-accountant", to: testEmail("invitee"), place: { level: "BUSINESS", business: "carthage" }, role: "Business accountant", state: "pending", note: "existing account, business invite" },
    { label: "newcomer", to: testEmail("newcomer"), place: { level: "SHOP", shop: "marsa" }, role: "Order handler", state: "pending", note: "no account yet: register with this email first, then open the link" },
    { label: "wrong-person", to: testEmail("someone-else"), place: { level: "SHOP", shop: "tunis" }, role: "Viewer", state: "pending", note: "for another email: accepting while logged in as somebody else must fail" },
    { label: "expired", to: testEmail("invitee"), place: { level: "SHOP", shop: "marsa" }, role: "Viewer", state: "expired", note: "past its date: must be refused" },
    { label: "revoked", to: testEmail("invitee"), place: { level: "SHOP", shop: "tunis" }, role: "Inventory clerk", state: "revoked", note: "cancelled by the team: must be refused" },
]

const BASE_URL = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
const DAY = 24 * 60 * 60 * 1000

// A fixed token per invite (43 URL-safe characters, same shape as a real one), so links survive re-runs
const tokenFor = (label: string) => createHash("sha256").update(`bayna-seed-team:${label}`).digest("base64url")
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

// ---------------------------------------------------------------------------
// The seeder
// ---------------------------------------------------------------------------

export const users: Seeder = {
    name: "users",
    kind: "test",
    description: "Test accounts, access and invitations (password " + SEED_PASSWORD + ")",
    needs: ["access"],
    async run({ prisma, log }) {
        const businessIds = new Map<string, string>()
        for (const [key, name] of Object.entries(COMPANY_NAMES)) {
            const b = await prisma.business.findFirst({ where: { name, deletedAt: null }, select: { id: true } })
            if (!b) throw new SeedError(`Company "${name}" is missing. Run: npm run seed businesses,shops,access`)
            businessIds.set(key, b.id)
        }
        const shopIds = new Map<string, string>()
        for (const [key, name] of Object.entries(SHOP_NAMES)) {
            const s = await prisma.shop.findFirst({ where: { name, deletedAt: null }, select: { id: true } })
            if (!s) throw new SeedError(`Shop "${name}" is missing. Run: npm run seed businesses,shops,access`)
            shopIds.set(key, s.id)
        }

        const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)
        const owner = await prisma.user.findFirst({ where: { email: "carthage@demo.bayna.test" }, select: { id: true } })
        const now = Date.now()

        const target = (place: Place) =>
            place.level === "BUSINESS"
                ? { scope: "BUSINESS" as const, businessId: businessIds.get(place.business)! }
                : { scope: "SHOP" as const, providerId: shopIds.get(place.shop)! }
        const roleOf = async (place: Place, name: string) => {
            const t = target(place)
            const role = await prisma.accessRole.findFirst({ where: { ...t, name }, select: { id: true } })
            if (!role) {
                throw new SeedError(
                    `There is no role "${name}" in ${place.level === "BUSINESS" ? COMPANY_NAMES[place.business] : SHOP_NAMES[place.shop]} ` +
                    `(renamed or deleted?). Run: npm run seed access`
                )
            }
            return { id: role.id, target: t }
        }

        // ---- People and what they can do -------------------------------------------------------
        for (const p of PEOPLE) {
            const type = p.platformRole ? "ADMIN" : p.grants.length ? "PROVIDER" : "CLIENT"
            const user = await prisma.user.upsert({
                where: { email: testEmail(p.local) },
                update: { name: p.name, role: type },
                create: { email: testEmail(p.local), name: p.name, password: passwordHash, role: type, emailVerified: new Date() },
                select: { id: true },
            })

            if (p.platformRole) {
                const role = await prisma.accessRole.findFirst({ where: { scope: "PLATFORM", name: p.platformRole }, select: { id: true } })
                if (!role) throw new SeedError(`There is no platform role "${p.platformRole}". Run: npm run seed platform`)
                const has = await prisma.accessAssignment.findFirst({ where: { userId: user.id, scope: "PLATFORM", roleId: role.id }, select: { id: true } })
                if (!has) await prisma.accessAssignment.create({ data: { userId: user.id, roleId: role.id, scope: "PLATFORM", status: "ACTIVE" } })
            }

            for (const g of p.grants) {
                const { id: roleId, target: t } = await roleOf(g.place, g.role)
                const data = {
                    status: g.status ?? ("ACTIVE" as const),
                    expiresAt: g.expiresInDays === undefined ? null : new Date(now + g.expiresInDays * DAY),
                    invitedById: owner?.id ?? null,
                }
                const has = await prisma.accessAssignment.findFirst({ where: { userId: user.id, roleId, ...t }, select: { id: true } })
                if (has) await prisma.accessAssignment.update({ where: { id: has.id }, data })
                else await prisma.accessAssignment.create({ data: { userId: user.id, roleId, ...t, ...data } })
            }
            log(`${testEmail(p.local).padEnd(38)} ${p.note}`)
        }

        // ---- Invitations -----------------------------------------------------------------------
        for (const inv of INVITES) {
            const { id: roleId, target: t } = await roleOf(inv.place, inv.role)
            const token = tokenFor(inv.label)
            const data = {
                ...t,
                roleId,
                email: inv.to,
                status: inv.state === "revoked" ? ("REVOKED" as const) : ("PENDING" as const),
                revokedAt: inv.state === "revoked" ? new Date() : null,
                acceptedAt: null,
                acceptedById: null,
                expiresAt: new Date(now + (inv.state === "expired" ? -2 : 30) * DAY),
                invitedById: owner?.id ?? null,
            }
            await prisma.accessInvite.upsert({
                where: { tokenHash: hashToken(token) },
                update: data,
                create: { ...data, tokenHash: hashToken(token) },
            })
            log(`[${inv.state}] ${inv.role} -> ${inv.to} (${inv.note})`)
            log(`    ${BASE_URL}/invite/${token}`)
        }

        return `${PEOPLE.length} accounts, ${INVITES.length} invitations (password ${SEED_PASSWORD})`
    },
}
