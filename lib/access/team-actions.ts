// lib/access/team-actions.ts
// Server helpers shared by the team routes and the invite accept route.
import { prisma } from "@/lib/prisma"
import type { Tx } from "@/lib/audit/run"
import { assertKeepsAnOwner, type OwnerChange, type OwnerCheck } from "./owners"
import { requireBusiness, requireShop } from "./guard"
import type { AuditActor } from "@/lib/audit/actor"
import { teamPermission, type TeamPermissionName, type TeamScope } from "./team-rules"

/** A refusal with a message the person can read. The routes turn it into a JSON error. */
export class TeamError extends Error {
    constructor(message: string, public status: 400 | 403 | 404 | 409 = 400) {
        super(message)
    }
}

export type TeamGuard = {
    ok: true
    userId: string
    actor: AuditActor
    scope: TeamScope
    providerId: string | null
    businessId: string | null
    /** may this person hold this key here? (for the "nobody hands out what they lack" rule) */
    can: (key: string) => boolean
}
export type TeamGuardFail = { ok: false; error: string; status: 401 | 403 | 404 }

/**
 * One guard for both levels. Pass the target (from the member or invite being acted on) to act on a
 * specific shop or business; without it the active shop or business is used. Either way the person
 * must really work there.
 */
export async function guardTeam(
    scope: TeamScope,
    name: TeamPermissionName,
    req: Request,
    target: { providerId?: string | null; businessId?: string | null } = {}
): Promise<TeamGuard | TeamGuardFail> {
    if (scope === "SHOP") {
        const g = await requireShop(teamPermission("SHOP", name), req, target.providerId ? { providerId: target.providerId } : {})
        if (!g.ok) return g
        return {
            ok: true,
            userId: g.userId,
            actor: g.actor,
            scope,
            providerId: g.provider.id,
            businessId: g.provider.businessId,
            can: (k) => g.can(k as never),
        }
    }
    const g = await requireBusiness(teamPermission("BUSINESS", name), req, target.businessId ? { businessId: target.businessId } : {})
    if (!g.ok) return g
    return {
        ok: true,
        userId: g.userId,
        actor: g.actor,
        scope,
        providerId: null,
        businessId: g.business.id,
        can: (k) => g.can(k as never),
    }
}

/**
 * The "there is always an owner" rule for either level (see owners.ts): a business needs a person
 * whose business-level role holds the ownership key. A shop needs one too, and a business-level
 * holder of its business counts: a branch does not need its own.
 */
export async function assertTeamKeepsOwner(
    tx: Tx,
    target: { scope: "SHOP"; providerId: string; businessId: string | null } | { scope: "BUSINESS"; businessId: string },
    change: OwnerChange,
    now: Date = new Date()
): Promise<OwnerCheck> {
    return target.scope === "BUSINESS"
        ? assertKeepsAnOwner(tx, { businessId: target.businessId }, change, now)
        : assertKeepsAnOwner(tx, { providerId: target.providerId, businessId: target.businessId }, change, now)
}

/** The name shown in messages: the shop's name, or the business's. */
export async function targetLabel(tx: Tx | typeof prisma, scope: TeamScope, id: string): Promise<string> {
    if (scope === "SHOP") {
        const shop = await tx.shop.findUnique({ where: { id }, select: { name: true } })
        return shop?.name ?? "the shop"
    }
    const business = await tx.business.findUnique({ where: { id }, select: { name: true } })
    return business?.name ?? "the business"
}

/** After a person loses an assignment: if they work nowhere any more, they go back to being a plain client. */
export async function demoteIfNoLongerWorking(tx: Tx, userId: string, now: Date = new Date()): Promise<void> {
    const [assignments, own, user] = await Promise.all([
        tx.accessAssignment.count({
            where: {
                userId,
                scope: { in: ["SHOP", "BUSINESS"] },
                status: "ACTIVE",
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        }),
        tx.shop.count({ where: { userId, deletedAt: null } }),
        tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ])
    // Only a PROVIDER goes back to CLIENT. An admin is never touched.
    if (user?.role === "PROVIDER" && assignments === 0 && own === 0) {
        await tx.user.update({ where: { id: userId }, data: { role: "CLIENT" } })
    }
}
