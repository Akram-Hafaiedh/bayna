// lib/access/shops.ts
// The shops a person works in (and applications still waiting), for the shop switcher.
// A shop counts when the person has a shop-level assignment for it, or a business-level assignment
// for the business it belongs to.
import { prisma } from "@/lib/prisma"

export type MyShop = {
    id: string
    /** the opaque id used in the shop's URLs (/shop/[publicId]/...) */
    publicId: string
    name: string
    city: string
    /** the business (company) this shop belongs to */
    businessId: string
    businessName: string
    /** role names that give access, e.g. ["Business owner"] or ["Manager"] */
    roles: string[]
    /** PENDING = an application an admin has not approved yet: shown, but cannot be opened */
    status: "ACTIVE" | "PENDING"
}

const live = (now: Date) => ({ status: "ACTIVE" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] })

export async function loadMyShops(userId: string, now: Date = new Date()): Promise<MyShop[]> {
    const [shopLevel, businessLevel, pending] = await Promise.all([
        prisma.accessAssignment.findMany({
            where: {
                userId,
                scope: "SHOP",
                providerId: { not: null },
                ...live(now),
                provider: { deletedAt: null, isVerified: true },
            },
            select: {
                role: { select: { name: true } },
                provider: { select: { id: true, publicId: true, name: true, city: true, business: { select: { id: true, name: true } } } },
            },
        }),
        prisma.accessAssignment.findMany({
            where: {
                userId,
                scope: "BUSINESS",
                businessId: { not: null },
                ...live(now),
                business: { deletedAt: null },
            },
            select: {
                role: { select: { name: true } },
                business: {
                    select: {
                        id: true,
                        name: true,
                        shops: {
                            where: { deletedAt: null, isVerified: true },
                            select: { id: true, publicId: true, name: true, city: true },
                        },
                    },
                },
            },
        }),
        prisma.shop.findMany({
            where: { userId, isVerified: false, deletedAt: null },
            select: { id: true, publicId: true, name: true, city: true, business: { select: { id: true, name: true } } },
        }),
    ])

    const byShop = new Map<string, MyShop>()
    const add = (shop: { id: string; publicId: string; name: string; city: string }, business: { id: string; name: string }, roleName: string) => {
        const existing = byShop.get(shop.id)
        if (existing) {
            if (!existing.roles.includes(roleName)) existing.roles.push(roleName)
            return
        }
        byShop.set(shop.id, {
            id: shop.id,
            publicId: shop.publicId,
            name: shop.name,
            city: shop.city,
            businessId: business.id,
            businessName: business.name,
            roles: [roleName],
            status: "ACTIVE",
        })
    }
    for (const a of shopLevel) {
        if (a.provider) add(a.provider, a.provider.business, a.role.name)
    }
    for (const a of businessLevel) {
        if (!a.business) continue
        for (const shop of a.business.shops) add(shop, { id: a.business.id, name: a.business.name }, a.role.name)
    }

    const byName = (x: MyShop, y: MyShop) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id)
    const active = [...byShop.values()].sort(byName)
    const waiting: MyShop[] = pending
        .filter((p) => !byShop.has(p.id))
        .map((p) => ({
            id: p.id,
            publicId: p.publicId,
            name: p.name,
            city: p.city,
            businessId: p.business.id,
            businessName: p.business.name,
            roles: [],
            status: "PENDING" as const,
        }))
        .sort(byName)
    return [...active, ...waiting]
}
