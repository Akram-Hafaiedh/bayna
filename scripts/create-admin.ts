// scripts/create-admin.ts
// Creates the first Super admin (or a new one) from the command line, for when nobody can sign in to the
// admin area yet. No password is typed or stored: the script prints a one-time link (valid 24 hours) where the
// person chooses their own password. Written to the activity log.
//
//   npm run db:create-admin -- you@example.com
//   npm run db:create-admin -- you@example.com --name "Your Name"
//
// Needs the platform roles: run `npm run seed platform` first (safe to run on a real database, it only creates
// the roles when there are none). Run it again to get a fresh link if the first one expired. The account must
// not work in a shop or business: staff use their own account.
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { parseEmail } from "../lib/auth/email-input"
import { newResetToken } from "../lib/auth/reset-token"
import { serializeActor, systemActor } from "../lib/audit/actor"
import { checkStaffAccount } from "../lib/access/staff-rules"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

function parseArgs(argv: string[]) {
    let email: string | undefined
    let name: string | undefined
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--name") name = argv[++i]
        else if (!argv[i].startsWith("--")) email = argv[i]
        else throw new Error(`Unknown option ${argv[i]}`)
    }
    if (!email) throw new Error('Usage: npm run db:create-admin -- you@example.com [--name "Your Name"]')
    const parsed = parseEmail(email)
    if (!parsed.ok) throw new Error(parsed.error)
    return { email: parsed.value, name: name?.trim() || undefined }
}

async function main() {
    const { email, name } = parseArgs(process.argv.slice(2))

    const role = await prisma.accessRole.findFirst({ where: { scope: "PLATFORM", name: "Super admin" }, select: { id: true } })
    if (!role) throw new Error('There is no platform role "Super admin". Run: npm run seed platform')

    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, name: true, email: true, status: true } })
    if (existing) {
        if (existing.status !== "ACTIVE") throw new Error(`That account is ${existing.status.toLowerCase().replace("_", " ")}. Reinstate it first.`)
        const account = checkStaffAccount({
            worksInShopOrBusiness: (await prisma.accessAssignment.count({ where: { userId: existing.id, scope: { in: ["SHOP", "BUSINESS"] } } })) > 0,
            ownsAShop: (await prisma.shop.count({ where: { applicantId: existing.id, deletedAt: null } })) > 0,
        })
        if (!account.ok) throw new Error(account.error)
    }

    const { token, hash } = newResetToken()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const user = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SYSTEM", "create-admin script"))}, true)`
        const u = existing
            ? await tx.user.update({ where: { id: existing.id }, data: { role: "ADMIN" }, select: { id: true, email: true } })
            : await tx.user.create({ data: { email, name: name ?? null, role: "ADMIN", emailVerified: new Date() }, select: { id: true, email: true } })

        const has = await tx.accessAssignment.findFirst({ where: { userId: u.id, scope: "PLATFORM" }, select: { id: true } })
        if (has) await tx.accessAssignment.update({ where: { id: has.id }, data: { roleId: role.id, status: "ACTIVE", expiresAt: null } })
        else await tx.accessAssignment.create({ data: { userId: u.id, roleId: role.id, scope: "PLATFORM", status: "ACTIVE" } })

        // One link at a time; only its hash is stored
        await tx.passwordResetToken.deleteMany({ where: { email: u.email } })
        await tx.passwordResetToken.create({ data: { email: u.email, token: hash, expires } })

        await tx.activityLog.create({
            data: {
                entityType: "User",
                entityId: u.id,
                action: "STAFF_CREATED_BY_SCRIPT",
                note: `${existing ? "Made" : "Created"} ${u.email} a Super admin from the command line`,
                source: "SYSTEM",
                actorName: "create-admin script",
            },
        })
        return u
    })

    const base = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")
    console.log(`\n${user.email} is a Super admin.`)
    console.log("Open this link to choose a password (valid 24 hours, works once). Do not share it:\n")
    console.log(`  ${base}/reset-password?token=${token}\n`)
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
