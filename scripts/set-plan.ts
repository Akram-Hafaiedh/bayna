// scripts/set-plan.ts
// Puts a business on a plan by hand (until a payment method exists). The change is written to the
// activity log. The arguments are checked in lib/plans/plan-assign.ts.
//
//   npm run db:set-plan -- <business public id> PRO --months 12 --note "paid by bank transfer"
//   npm run db:set-plan -- <business public id> PRO --trial-days 14
//   npm run db:set-plan -- <business public id> FREE
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { parseAssignArgs, subscriptionDates } from "@/lib/plans/plan-assign"
import { FREE_PLAN_KEY } from "@/lib/plans/plans"
import { serializeActor, systemActor } from "../lib/audit/actor"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const args = parseAssignArgs(process.argv.slice(2))
    if (!args.ok) throw new Error(args.error)
    const { businessPublicId, planKey, trialDays, months, note } = args.value

    const business = await prisma.business.findFirst({ where: { publicBusinessId: businessPublicId, deletedAt: null }, select: { id: true, name: true } })
    if (!business) throw new Error(`No business with public id ${businessPublicId}`)
    const plan = await prisma.plan.findUnique({ where: { key: planKey }, select: { id: true, name: true } })
    if (!plan) throw new Error(`No plan ${planKey}. Run "npm run seed plans" first.`)

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SYSTEM", "set-plan script"))}, true)`
        if (planKey === FREE_PLAN_KEY) {
            // The free plan is the absence of a subscription
            await tx.subscription.deleteMany({ where: { businessId: business.id } })
            return
        }
        const dates = subscriptionDates({ trialDays, months }, new Date())
        const data = { planId: plan.id, ...dates, canceledAt: null, note }
        await tx.subscription.upsert({ where: { businessId: business.id }, create: { businessId: business.id, ...data }, update: data })
    })
    console.log(`${business.name} is now on the ${plan.name} plan.`)
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
