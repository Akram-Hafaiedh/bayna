// scripts/normalize-emails.ts
// Makes every stored email trimmed and lowercase, so one address can only be one account.
// Needed once, for accounts created before emails were normalised.
//
//   npm run db:normalize-emails -- --dry    show what would change, change nothing
//   npm run db:normalize-emails             apply
//
// If two accounts differ only by case (for example Sami@x.com and sami@x.com) nothing is changed for
// either of them: they are listed so you can decide which to keep. Everything else is still updated.
// Changes are written as the "Email normalisation" actor, so they show up in ActivityLog.
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { serializeActor, systemActor } from "../lib/audit/actor"
import { normalizeEmail } from "../lib/auth/email-input"

const dry = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const users = await prisma.user.findMany({ select: { id: true, email: true } })

    const byNormal = new Map<string, { id: string; email: string }[]>()
    for (const u of users) {
        const key = normalizeEmail(u.email)
        byNormal.set(key, [...(byNormal.get(key) ?? []), u])
    }

    const clashes = [...byNormal.entries()].filter(([, list]) => list.length > 1)
    const clashing = new Set(clashes.flatMap(([, list]) => list.map((u) => u.id)))
    const clashingEmails = new Set(clashes.flatMap(([, list]) => list.map((u) => u.email)))
    const todo = users.filter((u) => !clashing.has(u.id) && normalizeEmail(u.email) !== u.email)

    console.log(`${users.length} accounts, ${todo.length} to change, ${clashes.length} clashing address(es).`)
    for (const u of todo) console.log(`  ${u.email}  ->  ${normalizeEmail(u.email)}`)
    for (const [key, list] of clashes) {
        console.log(`  CLASH ${key}: ${list.map((u) => `${u.email} (${u.id})`).join(", ")}  (left as they are)`)
    }
    if (dry || todo.length === 0) {
        if (dry) console.log("Dry run: nothing changed.")
        return
    }

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SEED", "Email normalisation"))}, true)`
        for (const u of todo) {
            await tx.user.update({ where: { id: u.id }, data: { email: normalizeEmail(u.email) } })
        }
        // A reset link that is still open must point at the new spelling
        const tokens = await tx.passwordResetToken.findMany({ select: { token: true, email: true } })
        for (const t of tokens) {
            if (normalizeEmail(t.email) !== t.email && !clashingEmails.has(t.email)) {
                await tx.passwordResetToken.update({ where: { token: t.token }, data: { email: normalizeEmail(t.email) } })
            }
        }
    })
    console.log("Done.")
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
