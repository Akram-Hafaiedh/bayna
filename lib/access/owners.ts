// lib/access/owners.ts
// The rule "a business (and a shop) always has an owner". There is no special Owner role: an owner is
// anyone whose live roles hold the ownership key of the level (catalogue.ts OWNERSHIP_KEY; a role with
// "*" holds it). Every action that can take an owner away (remove, suspend, change role, close the
// account) asks here first. The check itself is pure and unit tested.
import type { Tx } from "@/lib/audit/run"
import { OWNERSHIP_KEY, holdsKey } from "./catalogue"
import { isLive, type AssignmentInput } from "./evaluate"

export type LevelMember = {
    id: string // the assignment id
    /** the role holds the ownership key of this level */
    holdsOwnership: boolean
    /** active, unexpired, and the person's account is open */
    live: boolean
}

export type OwnerChange =
    | { type: "remove"; assignmentId: string }
    | { type: "suspend"; assignmentId: string }
    /** `newPermissions`: the permissions of the role they are moved to */
    | { type: "set_role"; assignmentId: string; newPermissions: readonly string[] }

export type OwnerCheck = { ok: true } | { ok: false; error: string }

const LAST_OWNER =
    "There must always be an owner. Make someone else an owner first (transfer ownership), then try again."

/** Would this change leave the level without a live owner? Changes that do not touch an owner always pass. */
export function checkOwnerRule(members: readonly LevelMember[], change: OwnerChange, ownershipKey: string): OwnerCheck {
    const target = members.find((m) => m.id === change.assignmentId)
    if (!target) return { ok: false, error: "That person does not work here" }

    if (!(target.live && target.holdsOwnership)) return { ok: true }
    if (change.type === "set_role" && holdsKey(change.newPermissions, ownershipKey)) return { ok: true }

    const others = members.filter((m) => m.id !== target.id && m.live && m.holdsOwnership)
    return others.length > 0 ? { ok: true } : { ok: false, error: LAST_OWNER }
}

/**
 * Reads the people at that level inside the transaction and applies the rule.
 * - A business needs a person with a business-level role that holds the business ownership key.
 * - A shop needs someone who holds the shop ownership key there: a shop-level role in that shop, or a
 *   business-level role of its business (a business owner owns every shop).
 */
export async function assertKeepsAnOwner(
    tx: Tx,
    target: { businessId: string } | { providerId: string; businessId: string | null },
    change: OwnerChange,
    now: Date = new Date()
): Promise<OwnerCheck> {
    const forBusiness = !("providerId" in target)
    const key = forBusiness ? OWNERSHIP_KEY.BUSINESS : OWNERSHIP_KEY.SHOP
    const where = forBusiness
        ? { scope: "BUSINESS" as const, businessId: target.businessId }
        : {
            OR: [
                { scope: "SHOP" as const, providerId: (target as { providerId: string }).providerId },
                ...(target.businessId ? [{ scope: "BUSINESS" as const, businessId: target.businessId }] : []),
            ],
        }
    const rows = await tx.accessAssignment.findMany({
        where,
        select: {
            id: true,
            scope: true,
            providerId: true,
            businessId: true,
            status: true,
            expiresAt: true,
            role: { select: { name: true, permissions: true } },
            user: { select: { status: true, deletedAt: true } },
        },
    })
    const members: LevelMember[] = rows.map((r) => {
        const input: AssignmentInput = r
        return {
            id: r.id,
            holdsOwnership: holdsKey(r.role.permissions, key),
            live: isLive(input, now) && r.user.status === "ACTIVE" && r.user.deletedAt === null,
        }
    })
    return checkOwnerRule(members, change, key)
}
