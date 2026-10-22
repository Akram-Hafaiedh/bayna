// prisma/seed/seeders/access.ts
// Default roles for every company and shop that has none, and the owner of every company. This is the
// same code as `npm run access:sync` (lib/access/sync.ts); it never rewrites a role someone edited.
import type { Seeder } from "../core"
import { syncAccess } from "../../../lib/access/sync"

export const access: Seeder = {
    name: "access",
    kind: "demo",
    description: "Default roles for companies and shops, and the company owners",
    needs: ["shops"],
    async run({ prisma, log }) {
        const lines = await syncAccess(prisma)
        for (const l of lines) log(l)
        return lines.length === 0 ? "already in sync" : `${lines.length} changes`
    },
}
