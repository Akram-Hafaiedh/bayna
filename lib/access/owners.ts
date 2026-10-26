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

/** One platform role held by a person, as read from the database. */
export type StaffRow = {
    userId: string
    status: "INVITED" | "ACTIVE" | "SUSPENDED"
    expiresAt: Date | null
    role: { permissions: readonly string[] }
    user: { status: string; deletedAt: Date | null }
}

/** Platform staff as owner-rule members, one per person (a person's access is the union of their roles). */
export function platformMembers(rows: readonly StaffRow[], key: string, now: Date): LevelMember[] {
    const byUser = new Map<string, LevelMember>()
    for (const r of rows) {
        const live =
            r.status === "ACTIVE" &&
            (r.expiresAt === null || r.expiresAt.getTime() > now.getTime()) &&
            r.user.status === "ACTIVE" &&
            r.user.deletedAt === null
        const m = byUser.get(r.userId) ?? { id: r.userId, holdsOwnership: false, live: false }
        // A person counts as an owner when one of their live roles holds the key
        if (live && holdsKey(r.role.permissions, key)) {
            m.holdsOwnership = true
            m.live = true
        }
        byUser.set(r.userId, m)
    }
    return [...byUser.values()]
}

/**
 * Would suspending (or banning) this account leave the platform without a live owner? Platform staff
 * are checked per person, not per assignment. Reads inside the transaction.
 */
export async function assertPlatformKeepsAnOwner(tx: Tx, userId: string, now: Date = new Date()): Promise<OwnerCheck> {
    const rows = await tx.accessAssignment.findMany({
        where: { scope: "PLATFORM" },
        select: {
            userId: true,
            status: true,
            expiresAt: true,
            role: { select: { name: true, permissions: true } },
            user: { select: { status: true, deletedAt: true } },
        },
    })
    const members = platformMembers(rows, OWNERSHIP_KEY.PLATFORM, now)
    // A person with no staff role is not on the list; nothing to protect
    if (!members.some((m) => m.id === userId)) return { ok: true }
    return checkOwnerRule(members, { type: "suspend", assignmentId: userId }, OWNERSHIP_KEY.PLATFORM)
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
