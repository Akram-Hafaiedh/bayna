// lib/access/shops.ts
// The shops a person works in (and applications still waiting), for the shop switcher.
import { prisma } from "@/lib/prisma"

export type MyShop = {
    id: string
    name: string
    city: string
    /** role names in this shop, e.g. ["Owner"] */
    roles: string[]
    /** PENDING = an application an admin has not approved yet: shown, but cannot be opened */
    status: "ACTIVE" | "PENDING"
}

export async function loadMyShops(userId: string, now: Date = new Date()): Promise<MyShop[]> {
    const [assignments, pending] = await Promise.all([
        prisma.accessAssignment.findMany({
            where: {
                userId,
                scope: "SHOP",
                status: "ACTIVE",
                providerId: { not: null },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                provider: { deletedAt: null, isVerified: true },
            },
            select: {
                providerId: true,
                role: { select: { name: true } },
                provider: { select: { id: true, businessName: true, city: true } },
            },
        }),
        prisma.provider.findMany({
            where: { userId, isVerified: false, deletedAt: null },
            select: { id: true, businessName: true, city: true },
        }),
    ])

    const byShop = new Map<string, MyShop>()
    for (const a of assignments) {
        if (!a.provider) continue
        const existing = byShop.get(a.provider.id)
        if (existing) {
            if (!existing.roles.includes(a.role.name)) existing.roles.push(a.role.name)
        } else {
            byShop.set(a.provider.id, {
                id: a.provider.id,
                name: a.provider.businessName,
                city: a.provider.city,
                roles: [a.role.name],
                status: "ACTIVE",
            })
        }
    }
    const active = [...byShop.values()].sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id))
    const waiting: MyShop[] = pending
        .map((p) => ({ id: p.id, name: p.businessName, city: p.city, roles: [], status: "PENDING" as const }))
        .sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id))
    return [...active, ...waiting]
}
