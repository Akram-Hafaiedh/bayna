// lib/access/owners.ts
// The rule "a shop always has an owner". Every action that can take an owner away (remove, suspend,
// change role, close the account) asks here first. The team routes (R2c) and account closing (R2d)
// call assertKeepsAnOwner(); the check itself is pure and unit tested.
import type { Tx } from "@/lib/audit/run"
import { isLive, type AssignmentInput } from "./evaluate"

export const OWNER_ROLE_KEY = "OWNER"

export type ShopMember = {
    id: string // the assignment id
    roleKey: string
    /** active, unexpired, and the person's account is open */
    live: boolean
}

export type OwnerChange =
    | { type: "remove"; assignmentId: string }
    | { type: "suspend"; assignmentId: string }
    | { type: "set_role"; assignmentId: string; roleKey: string }

export type OwnerCheck = { ok: true } | { ok: false; error: string }

const LAST_OWNER =
    "A shop must always have an owner. Make someone else an owner first (transfer ownership), then try again."

/** Would this change leave the shop without a live owner? Changes that do not touch an owner always pass. */
export function checkOwnerRule(members: readonly ShopMember[], change: OwnerChange): OwnerCheck {
    const target = members.find((m) => m.id === change.assignmentId)
    if (!target) return { ok: false, error: "That person does not work in this shop" }

    const isLiveOwner = target.live && target.roleKey === OWNER_ROLE_KEY
    if (!isLiveOwner) return { ok: true }
    if (change.type === "set_role" && change.roleKey === OWNER_ROLE_KEY) return { ok: true }

    const otherOwners = members.filter((m) => m.id !== target.id && m.live && m.roleKey === OWNER_ROLE_KEY)
    return otherOwners.length > 0 ? { ok: true } : { ok: false, error: LAST_OWNER }
}

/** Reads the shop's people inside the transaction and applies the rule. */
export async function assertKeepsAnOwner(tx: Tx, providerId: string, change: OwnerChange, now: Date = new Date()): Promise<OwnerCheck> {
    const rows = await tx.accessAssignment.findMany({
        where: { scope: "SHOP", providerId },
        select: {
            id: true,
            scope: true,
            providerId: true,
            status: true,
            expiresAt: true,
            grants: true,
            denies: true,
            role: { select: { key: true, permissions: true } },
            user: { select: { status: true, deletedAt: true } },
        },
    })
    const members: ShopMember[] = rows.map((r) => {
        const input: AssignmentInput = r
        return {
            id: r.id,
            roleKey: r.role.key,
            live: isLive(input, now) && r.user.status === "ACTIVE" && r.user.deletedAt === null,
        }
    })
    return checkOwnerRule(members, change)
}
