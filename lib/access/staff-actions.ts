// lib/access/staff-actions.ts
// The database side of the Staff page (the rules are in staff-rules.ts). Server only.
import type { Tx } from "@/lib/audit/run"
import { checkStaffOwnerRule, type StaffChange } from "./staff-rules"
import type { OwnerCheck } from "./owners"

/** Reads every platform assignment inside the transaction and applies the owner rule to the change. */
export async function assertStaffKeepsOwner(tx: Tx, change: StaffChange, now: Date = new Date()): Promise<OwnerCheck> {
    const rows = await tx.accessAssignment.findMany({
        where: { scope: "PLATFORM" },
        select: {
            id: true,
            userId: true,
            status: true,
            expiresAt: true,
            role: { select: { permissions: true } },
            user: { select: { status: true, deletedAt: true } },
        },
    })
    return checkStaffOwnerRule(rows, change, now)
}

/** Does this account work in a shop or a business, or own a shop? Then it cannot also be staff. */
export async function worksInShopOrBusiness(tx: Pick<Tx, "accessAssignment" | "shop">, userId: string): Promise<{ worksInShopOrBusiness: boolean; ownsAShop: boolean }> {
    const [assignments, shops] = await Promise.all([
        tx.accessAssignment.count({ where: { userId, scope: { in: ["SHOP", "BUSINESS"] } } }),
        tx.shop.count({ where: { applicantId: userId, deletedAt: null } }),
    ])
    return { worksInShopOrBusiness: assignments > 0, ownsAShop: shops > 0 }
}

/** After a person loses their last platform role: an ADMIN account goes back to a plain client. */
export async function demoteIfNoLongerStaff(tx: Tx, userId: string): Promise<void> {
    const [left, user] = await Promise.all([
        tx.accessAssignment.count({ where: { userId, scope: "PLATFORM" } }),
        tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ])
    if (left === 0 && user?.role === "ADMIN") await tx.user.update({ where: { id: userId }, data: { role: "CLIENT" } })
}

/** The wording used in activity and notifications for the platform "place". */
export const STAFF_PLACE = "the Bayna team"
