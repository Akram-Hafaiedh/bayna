// prisma/seed/seeders/platform.ts
// The platform's own roles (Super admin, Admin, Support agent, ...): copied from the templates in
// lib/access/role-templates.ts, only when the platform has none. Never touches roles someone edited.
import type { Seeder } from "../core"
import { seedPlatformRoles } from "../../../lib/access/role-seed"
import { serializeActor, systemActor } from "../../../lib/audit/actor"

export const platform: Seeder = {
    name: "platform",
    kind: "reference",
    description: "Platform roles (Super admin, Admin, Support agent, ...)",
    needs: [],
    async run({ prisma, log }) {
        const created = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SEED", "Seed"))}, true)`
            if ((await tx.accessRole.count({ where: { scope: "PLATFORM" } })) > 0) return 0
            return seedPlatformRoles(tx)
        })
        if (created === 0) log("platform roles already exist")
        return created === 0 ? "already there" : `${created} platform roles`
    },
}
