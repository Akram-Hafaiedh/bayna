// prisma/seed/seeders/plans.ts
// The plans (Free, Pro, Business) and their limits, copied from DEFAULT_PLANS in lib/plans/plans.ts. Creates
// only the plans that are missing: a plan an admin edited is never overwritten. The one exception: a
// plan that has no price at all gets the default prices (it was created before prices existed).
import type { Seeder } from "../core"
import { DEFAULT_PLANS } from "@/lib/plans/plans"
import { serializeActor, systemActor } from "@/lib/audit/actor"

export const plans: Seeder = {
    name: "plans",
    kind: "reference",
    description: "Plans (Free, Pro, Business) with their limits",
    needs: [],
    async run({ prisma, log }) {
        const created = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SEED", "Seed"))}, true)`
            let n = 0
            for (const p of DEFAULT_PLANS) {
                const existing = await tx.plan.findUnique({ where: { key: p.key }, select: { id: true, priceMonthly: true, priceYearly: true } })
                if (existing) {
                    const unpriced = existing.priceMonthly === null && existing.priceYearly === null
                    if (unpriced && (p.priceMonthly !== null || p.priceYearly !== null)) {
                        await tx.plan.update({ where: { id: existing.id }, data: { priceMonthly: p.priceMonthly, priceYearly: p.priceYearly } })
                        n++
                    }
                    continue
                }
                await tx.plan.create({
                    data: {
                        key: p.key,
                        name: p.name,
                        description: p.description,
                        priceMonthly: p.priceMonthly,
                        priceYearly: p.priceYearly,
                        limits: JSON.parse(JSON.stringify(p.limits)),
                        features: JSON.parse(JSON.stringify(p.features)),
                        sortOrder: p.sortOrder,
                    },
                })
                n++
            }
            return n
        })
        if (created === 0) log("plans already exist, with their prices")
        return created === 0 ? "already there" : `${created} plans created or priced`
    },
}
