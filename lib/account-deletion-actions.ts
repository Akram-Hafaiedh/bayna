// lib/account-deletion-actions.ts
// The database side of deleting an account: what stops it (blockers). Server only. Imports are relative so the
// purge script can use it too. The rules and wording are in account-deletion.ts.
import type { Tx } from "./audit/run"
import { assertKeepsAnOwner, assertPlatformKeepsAnOwner } from "./access/owners"
import { blocker } from "./account-deletion"

/** What this person must hand over or finish before the account can go. Empty = free to go. */
export async function deletionBlockers(tx: Tx, userId: string, now: Date = new Date()): Promise<string[]> {
    const out: string[] = []

    const assignments = await tx.accessAssignment.findMany({
        where: { userId, scope: { in: ["SHOP", "BUSINESS"] } },
        select: {
            id: true, scope: true, providerId: true, businessId: true,
            provider: { select: { name: true, businessId: true } },
            business: { select: { name: true } },
        },
    })
    for (const a of assignments) {
        if (a.scope === "BUSINESS" && a.businessId) {
            const rule = await assertKeepsAnOwner(tx, { businessId: a.businessId }, { type: "remove", assignmentId: a.id }, now)
            if (!rule.ok) out.push(blocker.owner(a.business?.name ?? "a business"))
        } else if (a.scope === "SHOP" && a.providerId) {
            const rule = await assertKeepsAnOwner(tx, { providerId: a.providerId, businessId: a.provider?.businessId ?? null }, { type: "remove", assignmentId: a.id }, now)
            if (!rule.ok) out.push(blocker.owner(a.provider?.name ?? "a shop"))
        }
    }

    if (!(await assertPlatformKeepsAnOwner(tx, userId, now)).ok) out.push(blocker.platform())

    const waiting = await tx.shop.findMany({
        where: { userId, deletedAt: null, status: { in: ["DRAFT", "PENDING"] } },
        select: { name: true },
    })
    for (const s of waiting) out.push(blocker.application(s.name))

    return [...new Set(out)]
}
