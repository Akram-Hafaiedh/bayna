// scripts/set-price.ts
// Changes the prices of a plan (monthly, yearly or both). The change is written to the activity log.
// The arguments are checked in lib/plan-price.ts.
//
//   npm run db:set-price -- PRO --monthly 45 --yearly 450
//   npm run db:set-price -- PRO --yearly 420
//   npm run db:set-price -- PRO --monthly none
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { parsePriceArgs, priceWarnings } from "@/lib/plans/plan-price"
import { serializeActor, systemActor } from "@/lib/audit/actor"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const num = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()))

async function main() {
    const args = parsePriceArgs(process.argv.slice(2))
    if (!args.ok) throw new Error(args.error)
    const { planKey, monthly, yearly } = args.value

    const plan = await prisma.plan.findUnique({ where: { key: planKey }, select: { id: true, name: true, priceMonthly: true, priceYearly: true } })
    if (!plan) throw new Error(`No plan ${planKey}. Run "npm run seed plans" first.`)

    const nextMonthly = monthly === undefined ? num(plan.priceMonthly) : monthly
    const nextYearly = yearly === undefined ? num(plan.priceYearly) : yearly

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SYSTEM", "set-price script"))}, true)`
        await tx.plan.update({ where: { id: plan.id }, data: { priceMonthly: nextMonthly, priceYearly: nextYearly } })
    })
    console.log(`${plan.name}: ${nextMonthly ?? "no"} TND / month, ${nextYearly ?? "no"} TND / year.`)
    for (const w of priceWarnings(nextMonthly, nextYearly)) console.log(`Note: ${w}`)
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
