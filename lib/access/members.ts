// lib/access/members.ts
// Who in a shop holds a permission. Used to decide who to notify ("the people who can edit prices").
import type { Tx } from "@/lib/audit/run"
import type { ShopPermission } from "./catalogue"
import { can, type AssignmentInput } from "./evaluate"

export type MemberAssignment = AssignmentInput & { userId: string }

/**
 * Pure: the distinct people who hold `key` in `shopId`, from a list of assignments. Pass the
 * shop's `businessId` so business-level members (an owner, an accountant) count too.
 */
export function membersWithPermission(
    rows: readonly MemberAssignment[],
    shopId: string,
    key: ShopPermission,
    now: Date = new Date(),
    businessId: string | null = null
): string[] {
    const byUser = new Map<string, AssignmentInput[]>()
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r])
    return [...byUser.entries()]
        .filter(([, list]) => can(list, key, { shopId, businessId }, now))
        .map(([userId]) => userId)
}

/** For several shops at once: shop id -> people who hold `key` there. Skips closed or deleted accounts. */
export async function loadShopMembersWith(
    tx: Tx,
    shopIds: string[],
    key: ShopPermission,
    now: Date = new Date()
): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (shopIds.length === 0) return out

    const shops = await tx.shop.findMany({ where: { id: { in: shopIds } }, select: { id: true, businessId: true } })
    const businessOf = new Map(shops.map((s) => [s.id, s.businessId]))
    const businessIds = [...new Set(shops.flatMap((s) => (s.businessId ? [s.businessId] : [])))]

    const rows = await tx.accessAssignment.findMany({
        where: {
            status: "ACTIVE",
            user: { status: "ACTIVE", deletedAt: null },
            OR: [
                { scope: "SHOP", shopId: { in: shopIds } },
                { scope: "BUSINESS", businessId: { in: businessIds } },
            ],
        },
        select: {
            userId: true,
            scope: true,
            shopId: true,
            businessId: true,
            status: true,
            expiresAt: true,
            role: { select: { name: true, permissions: true } },
        },
    })
    for (const id of shopIds) {
        out.set(id, membersWithPermission(rows, id, key, now, businessOf.get(id) ?? null))
    }
    return out
}
