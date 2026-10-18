// lib/access/members.ts
// Who in a shop holds a permission. Used to decide who to notify ("the people who can edit prices").
import type { Tx } from "@/lib/audit/run"
import type { ShopPermission } from "./catalogue"
import { can, type AssignmentInput } from "./evaluate"

export type MemberAssignment = AssignmentInput & { userId: string }

/** Pure: the distinct people who hold `key` in `providerId`, from a list of assignments. */
export function membersWithPermission(
    rows: readonly MemberAssignment[],
    providerId: string,
    key: ShopPermission,
    now: Date = new Date()
): string[] {
    const byUser = new Map<string, AssignmentInput[]>()
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r])
    return [...byUser.entries()]
        .filter(([, list]) => can(list, key, { providerId }, now))
        .map(([userId]) => userId)
}

/** For several shops at once: shop id -> people who hold `key` there. Skips closed or deleted accounts. */
export async function loadShopMembersWith(
    tx: Tx,
    providerIds: string[],
    key: ShopPermission,
    now: Date = new Date()
): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (providerIds.length === 0) return out

    const rows = await tx.accessAssignment.findMany({
        where: {
            scope: "SHOP",
            status: "ACTIVE",
            providerId: { in: providerIds },
            user: { status: "ACTIVE", deletedAt: null },
        },
        select: {
            userId: true,
            scope: true,
            providerId: true,
            status: true,
            expiresAt: true,
            grants: true,
            denies: true,
            role: { select: { key: true, permissions: true } },
        },
    })
    for (const id of providerIds) {
        out.set(id, membersWithPermission(rows, id, key, now))
    }
    return out
}
