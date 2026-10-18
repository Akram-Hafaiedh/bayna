// lib/access/business-options.ts
// The businesses a person may add a shop to: those where they hold business.shop.create
// (a business owner does). Used by the "Create shop" form and the apply route.
import { prisma } from "@/lib/prisma"
import { can } from "./evaluate"
import { loadAccess } from "./load"
import { reachableBusinessIds } from "./reach"

export async function businessesForNewShop(userId: string, now: Date = new Date()): Promise<{ id: string; name: string }[]> {
    const access = await loadAccess(userId)
    if (!access || access.status !== "ACTIVE") return []

    const ids = reachableBusinessIds(access.assignments, now).filter((id) =>
        can(access.assignments, "business.shop.create", { businessId: id }, now)
    )
    if (ids.length === 0) return []

    const rows = await prisma.business.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
    })
    return rows
}
