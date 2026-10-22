// prisma/seed-test-users.ts
// TEST ACCOUNTS ONLY. Creates people with different roles in the demo company, and people with NO
// access at all, so you can test invitations, invite links, roles, permissions and who may open what.
// Every account uses the same known password. Refuses to run when NODE_ENV=production.
//
// Prerequisites (in this order):
//   npx tsx prisma/seed.ts            (catalogue)
//   npx tsx prisma/seed-demo.ts       (demo company "Demo - Carthage Group SARL" with 2 shops)
//   npm run access:sync               (default roles + the company owner)
// Run:   npm run seed:test-users
//
// Idempotent: accounts and assignments are updated in place. Invitation links are NEW on every run
// (the old unused ones for these test emails are revoked), and are printed at the end.
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { hashInviteToken, inviteExpiry, newInviteToken } from "../lib/access/invite-token"

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_DEMO !== "1") {
    console.error("Refusing to seed test users with NODE_ENV=production. Set SEED_ALLOW_DEMO=1 to override.")
    process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const PASSWORD = process.env.SEED_TEST_PASSWORD ?? "test1234"
const DOMAIN = "test.bayna.test"
const COMPANY = "Demo - Carthage Group SARL"
const SHOP_A = "Demo - Carthage Materials"
const SHOP_B = "Demo - Carthage Materials La Marsa"
const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000"
const DAY = 24 * 60 * 60 * 1000

type Place = { level: "BUSINESS" } | { level: "SHOP"; shop: string }
type Grant = Place & { role: string; status?: "ACTIVE" | "SUSPENDED"; expiresAt?: Date }

// People who already work somewhere (account type PROVIDER, like after accepting an invite)
const TEAM: { local: string; name: string; why: string; grants: Grant[] }[] = [
    {
        local: "manager.carthage", name: "Test Manager Carthage",
        why: "Manager of ONE shop (Carthage). Must not reach La Marsa or the business area.",
        grants: [{ level: "SHOP", shop: SHOP_A, role: "Manager" }],
    },
    {
        local: "orders.carthage", name: "Test Orders Carthage",
        why: "Order handler in Carthage only: orders yes, products/team/profile no.",
        grants: [{ level: "SHOP", shop: SHOP_A, role: "Order handler" }],
    },
    {
        local: "stock.marsa", name: "Test Stock La Marsa",
        why: "Inventory clerk in La Marsa only: products and stock, nothing about team or money.",
        grants: [{ level: "SHOP", shop: SHOP_B, role: "Inventory clerk" }],
    },
    {
        local: "viewer.marsa", name: "Test Viewer La Marsa",
        why: "Read-only in La Marsa: every Create/Edit/Delete button must be refused.",
        grants: [{ level: "SHOP", shop: SHOP_B, role: "Viewer" }],
    },
    {
        local: "both.shops", name: "Test Two Shops",
        why: "Manager in Carthage AND Viewer in La Marsa: tests the shop switcher and per-shop rights.",
        grants: [
            { level: "SHOP", shop: SHOP_A, role: "Manager" },
            { level: "SHOP", shop: SHOP_B, role: "Viewer" },
        ],
    },
    {
        local: "accountant.business", name: "Test Business Accountant",
        why: "Business-level accountant: reaches the Business area and the money of every shop.",
        grants: [{ level: "BUSINESS", role: "Business accountant" }],
    },
    {
        local: "ops.business", name: "Test Operations",
        why: "Business-level Operations role: works across all shops, no ownership rights.",
        grants: [{ level: "BUSINESS", role: "Operations" }],
    },
    {
        local: "hr.business", name: "Test HR",
        why: "Business-level HR: team and roles, no products or money.",
        grants: [{ level: "BUSINESS", role: "HR" }],
    },
    {
        local: "expired.manager", name: "Test Expired Manager",
        why: "Manager in Carthage whose access ended yesterday: must be treated as having no access.",
        grants: [{ level: "SHOP", shop: SHOP_A, role: "Manager", expiresAt: new Date(Date.now() - DAY) }],
    },
    {
        local: "suspended.viewer", name: "Test Suspended Viewer",
        why: "Viewer in Carthage whose membership is suspended: must be refused until reinstated.",
        grants: [{ level: "SHOP", shop: SHOP_A, role: "Viewer", status: "SUSPENDED" }],
    },
]

// People with NO access anywhere (account type CLIENT): the ones to invite
const NO_ACCESS: { local: string; name: string; why: string }[] = [
    { local: "invitee1", name: "Test Invitee One", why: "Has a pending shop invitation (link printed below)." },
    { local: "invitee2", name: "Test Invitee Two", why: "Has a pending business invitation (link printed below)." },
    { local: "invitee3", name: "Test Invitee Three", why: "Has an EXPIRED invitation: the link must be refused." },
    { local: "invitee4", name: "Test Invitee Four", why: "Has a REVOKED invitation: the link must be refused." },
    { local: "nobody1", name: "Test Nobody One", why: "No invitation. Invite this email yourself from Team → Invite." },
    { local: "nobody2", name: "Test Nobody Two", why: "No invitation. Use for the wrong-account test: open invitee1's link while signed in as this user." },
    { local: "client1", name: "Test Client", why: "A plain client: /provider and /business must send this account away." },
]

const email = (local: string) => `${local}@${DOMAIN}`

async function main() {
    const business = await prisma.business.findFirst({ where: { name: COMPANY, deletedAt: null }, select: { id: true } })
    if (!business) throw new Error(`Business "${COMPANY}" not found. Run: npx tsx prisma/seed-demo.ts`)
    const shops = await prisma.shop.findMany({
        where: { businessId: business.id, name: { in: [SHOP_A, SHOP_B] }, deletedAt: null },
        select: { id: true, name: true },
    })
    const shopId = new Map(shops.map((s) => [s.name, s.id]))
    for (const n of [SHOP_A, SHOP_B]) if (!shopId.has(n)) throw new Error(`Shop "${n}" not found. Run: npx tsx prisma/seed-demo.ts`)

    const [businessRoles, shopRoles] = await Promise.all([
        prisma.accessRole.findMany({ where: { scope: "BUSINESS", businessId: business.id }, select: { id: true, name: true } }),
        prisma.accessRole.findMany({ where: { scope: "SHOP", providerId: { in: [...shopId.values()] } }, select: { id: true, name: true, providerId: true } }),
    ])
    if (businessRoles.length === 0 || shopRoles.length === 0) throw new Error("The companies have no roles yet. Run: npm run access:sync")

    const businessRole = (name: string) => {
        const r = businessRoles.find((x) => x.name === name)
        if (!r) throw new Error(`Business role "${name}" not found. Has it been renamed or deleted? Existing: ${businessRoles.map((x) => x.name).join(", ")}`)
        return r.id
    }
    const shopRole = (shop: string, name: string) => {
        const r = shopRoles.find((x) => x.providerId === shopId.get(shop) && x.name === name)
        if (!r) throw new Error(`Shop role "${name}" not found in "${shop}". Has it been renamed or deleted? Existing: ${shopRoles.filter((x) => x.providerId === shopId.get(shop)).map((x) => x.name).join(", ")}`)
        return r.id
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 10)
    const upsertUser = (local: string, name: string, role: "CLIENT" | "PROVIDER") =>
        prisma.user.upsert({
            where: { email: email(local) },
            update: { name, role, password: passwordHash, status: "ACTIVE", deletedAt: null },
            create: { email: email(local), name, role, password: passwordHash, emailVerified: new Date() },
            select: { id: true },
        })

    // ---- people with access ---------------------------------------------------------------
    for (const t of TEAM) {
        const user = await upsertUser(t.local, t.name, "PROVIDER")
        // The set of access is exactly what is listed here: anything else this test user had is removed
        await prisma.accessAssignment.deleteMany({ where: { userId: user.id } })
        for (const g of t.grants) {
            const common = { userId: user.id, status: g.status ?? "ACTIVE", expiresAt: g.expiresAt ?? null }
            if (g.level === "BUSINESS") {
                await prisma.accessAssignment.create({
                    data: { ...common, roleId: businessRole(g.role), scope: "BUSINESS", businessId: business.id },
                })
            } else {
                await prisma.accessAssignment.create({
                    data: { ...common, roleId: shopRole(g.shop, g.role), scope: "SHOP", providerId: shopId.get(g.shop)! },
                })
            }
        }
    }

    // ---- people without access -------------------------------------------------------------
    for (const n of NO_ACCESS) {
        const user = await upsertUser(n.local, n.name, "CLIENT")
        await prisma.accessAssignment.deleteMany({ where: { userId: user.id } })
    }

    // ---- invitations (new links every run) ---------------------------------------------------
    const inviter = await prisma.user.findFirst({
        where: { email: "carthage@demo.bayna.test" },
        select: { id: true },
    })
    await prisma.accessInvite.updateMany({
        where: { email: { in: NO_ACCESS.map((n) => email(n.local)) }, status: "PENDING" },
        data: { status: "REVOKED", revokedAt: new Date() },
    })
    await prisma.accessInvite.deleteMany({
        where: { email: { in: NO_ACCESS.map((n) => email(n.local)) }, status: "REVOKED", revokedAt: { not: null } },
    })

    const links: { who: string; what: string; url: string; state: string }[] = []
    const invite = async (
        local: string,
        what: string,
        target: { scope: "SHOP"; providerId: string; roleId: string } | { scope: "BUSINESS"; businessId: string; roleId: string },
        state: "pending" | "expired" | "revoked"
    ) => {
        const token = newInviteToken()
        await prisma.accessInvite.create({
            data: {
                ...target,
                email: email(local),
                tokenHash: hashInviteToken(token),
                status: state === "revoked" ? "REVOKED" : "PENDING",
                revokedAt: state === "revoked" ? new Date() : null,
                expiresAt: state === "expired" ? new Date(Date.now() - DAY) : inviteExpiry(),
                invitedById: inviter?.id ?? null,
            },
        })
        links.push({ who: email(local), what, url: `${BASE_URL}/invite/${token}`, state })
    }
    await invite("invitee1", `Manager of ${SHOP_A}`, { scope: "SHOP", providerId: shopId.get(SHOP_A)!, roleId: shopRole(SHOP_A, "Manager") }, "pending")
    await invite("invitee2", `Business accountant of ${COMPANY}`, { scope: "BUSINESS", businessId: business.id, roleId: businessRole("Business accountant") }, "pending")
    await invite("invitee3", `Viewer of ${SHOP_B}`, { scope: "SHOP", providerId: shopId.get(SHOP_B)!, roleId: shopRole(SHOP_B, "Viewer") }, "expired")
    await invite("invitee4", `Viewer of ${SHOP_A}`, { scope: "SHOP", providerId: shopId.get(SHOP_A)!, roleId: shopRole(SHOP_A, "Viewer") }, "revoked")

    // ---- report -------------------------------------------------------------------------------
    console.log(`\nTest accounts ready. Password for all of them: ${PASSWORD}\n`)
    console.log("PEOPLE WITH ACCESS (log in, then check what they can and cannot open)")
    for (const t of TEAM) console.log(`  ${email(t.local).padEnd(40)} ${t.why}`)
    console.log("\nPEOPLE WITHOUT ACCESS")
    for (const n of NO_ACCESS) console.log(`  ${email(n.local).padEnd(40)} ${n.why}`)
    console.log("\nINVITATION LINKS (sign in as the invited email first; each link only works for that email)")
    for (const l of links) console.log(`  [${l.state}] ${l.who} → ${l.what}\n    ${l.url}`)
    console.log("")
}

main()
    .catch((e) => {
        console.error(e)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
