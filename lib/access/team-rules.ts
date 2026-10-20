// lib/access/team-rules.ts
// The rules of the team page, kept pure so they are unit tested. Who may invite, change, suspend
// or remove whom, and which roles a person may hand out.
//
// The one idea behind most of it: nobody can give or change access they do not hold themselves.
// A manager cannot make an owner, and cannot touch one. The "last owner" rule is separate
// (owners.ts) and is applied by the routes after these checks.
import { fail, ok, type Parsed } from "@/lib/parse"
import { normalizeEmail, parseEmail } from "@/lib/email-input"
import type { BusinessPermission, ShopPermission } from "./catalogue"

export type TeamScope = "SHOP" | "BUSINESS"
export type MemberAction =
    | { type: "set_role"; roleKey: string }
    | { type: "suspend" }
    | { type: "reinstate" }
    | { type: "remove" }

export type TeamPermissionName = "view" | "invite" | "set_role" | "suspend" | "reinstate" | "remove"

/** The permission key that opens each team action, by level. */
export function teamPermission(scope: "SHOP", name: TeamPermissionName): ShopPermission
export function teamPermission(scope: "BUSINESS", name: TeamPermissionName): BusinessPermission
export function teamPermission(scope: TeamScope, name: TeamPermissionName): ShopPermission | BusinessPermission
export function teamPermission(scope: TeamScope, name: TeamPermissionName): ShopPermission | BusinessPermission {
    const prefix = scope === "SHOP" ? "team.member" : "business.team"
    const action =
        name === "set_role" ? "update_role" : name === "reinstate" ? "suspend" : name // reinstate uses the suspend key
    // The keys are checked against the catalogue in team-rules.test.ts
    return `${prefix}.${action}` as ShopPermission | BusinessPermission
}

/** The keys of `permissions` that the actor does not hold. Empty = the actor could hold this role. */
export function missingKeys(permissions: readonly string[], can: (key: string) => boolean): string[] {
    return permissions.filter((k) => !can(k))
}

/** The roles this actor may hand out: only those whose every key they hold themselves. */
export function assignableRoles<T extends { permissions: readonly string[] }>(roles: readonly T[], can: (key: string) => boolean): T[] {
    return roles.filter((r) => missingKeys(r.permissions, can).length === 0)
}

export type MemberActionCheck = { ok: true } | { ok: false; error: string; status: 400 | 403 }

/**
 * May the actor do this to this member? (Permission to do the action at all is checked by the guard.)
 * - you cannot change your own role or suspend yourself; you may remove yourself (leave)
 * - you cannot touch someone who holds keys you do not
 * - you cannot give a role that holds keys you do not
 */
export function checkMemberAction(input: {
    actorUserId: string
    targetUserId: string
    targetRolePermissions: readonly string[]
    newRolePermissions?: readonly string[]
    action: MemberAction
    can: (key: string) => boolean
}): MemberActionCheck {
    const { actorUserId, targetUserId, action, can } = input
    const self = actorUserId === targetUserId

    if (self && action.type !== "remove") {
        return { ok: false, error: "You cannot change your own role or access. Ask another owner.", status: 403 }
    }
    if (!self && missingKeys(input.targetRolePermissions, can).length > 0) {
        return { ok: false, error: "You cannot change someone who has more access than you do.", status: 403 }
    }
    if (action.type === "set_role") {
        if (!input.newRolePermissions) return { ok: false, error: "Unknown role", status: 400 }
        if (missingKeys(input.newRolePermissions, can).length > 0) {
            return { ok: false, error: "You cannot give a role with more access than your own.", status: 403 }
        }
    }
    return { ok: true }
}

/** targetId: the shop or business to invite to; null = the one the person is working in. */
export type InviteInput = { scope: TeamScope; email: string; roleKey: string; targetId: string | null }

/** Body of POST /api/provider/team/invites. */
export function parseInviteInput(body: unknown): Parsed<InviteInput> {
    if (!body || typeof body !== "object") return fail("Send the person's email and a role")
    const b = body as Record<string, unknown>
    if (b.scope !== "SHOP" && b.scope !== "BUSINESS") return fail("Choose whether to invite to the shop or to the business")
    const email = parseEmail(b.email)
    if (!email.ok) return fail(email.error)
    if (typeof b.roleKey !== "string" || !/^[A-Z_]{2,40}$/.test(b.roleKey)) return fail("Choose a role")
    let targetId: string | null = null
    if (b.targetId !== undefined && b.targetId !== null) {
        if (typeof b.targetId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(b.targetId)) return fail("Unknown shop or business")
        targetId = b.targetId
    }
    return ok({ scope: b.scope, email: email.value, roleKey: b.roleKey, targetId })
}

/** Body of PATCH /api/provider/team/members/[id]. (Removing is DELETE and needs no body.) */
export function parseMemberAction(body: unknown): Parsed<MemberAction> {
    if (!body || typeof body !== "object") return fail("Say what to do")
    const b = body as Record<string, unknown>
    if (b.action === "suspend") return ok({ type: "suspend" })
    if (b.action === "reinstate") return ok({ type: "reinstate" })
    if (b.action === "set_role") {
        if (typeof b.roleKey !== "string" || !/^[A-Z_]{2,40}$/.test(b.roleKey)) return fail("Choose a role")
        return ok({ type: "set_role", roleKey: b.roleKey })
    }
    return fail("Unknown action")
}

export type MemberStatusName = "ACTIVE" | "SUSPENDED" | "INVITED"

/** Where does a member's status go for this action? Remove has no status (the row is deleted). */
export function nextStatus(action: MemberAction["type"]): MemberStatusName | null {
    if (action === "suspend") return "SUSPENDED"
    if (action === "reinstate") return "ACTIVE"
    return null
}

/** Human wording for the activity page and notifications. */
export function describeAction(action: MemberAction["type"]): string {
    switch (action) {
        case "set_role": return "changed the role of"
        case "suspend": return "suspended"
        case "reinstate": return "reinstated"
        case "remove": return "removed"
    }
}

/**
 * Who an invitation may go to. Run on the server before a link is made.
 * `member`: the invited person's assignment at the level being invited to, if any.
 * `viaBusiness`: for a shop invitation, whether they already reach this shop through a live business-level role.
 */
export type InviteeCheck = { ok: true } | { ok: false; error: string }
export function checkInvitee(input: {
    inviteeEmail: string
    actorEmail: string | null
    scope: TeamScope
    member: "ACTIVE" | "SUSPENDED" | null
    viaBusiness: boolean
}): InviteeCheck {
    if (input.actorEmail && normalizeEmail(input.actorEmail) === normalizeEmail(input.inviteeEmail)) {
        return { ok: false, error: "That is your own email address. You are already on this team." }
    }
    if (input.member === "SUSPENDED") {
        return { ok: false, error: "That person is already on the team but suspended. Reinstate them instead." }
    }
    if (input.member === "ACTIVE") {
        return { ok: false, error: "That person is already on the team. Change their role from the team list." }
    }
    if (input.scope === "SHOP" && input.viaBusiness) {
        return { ok: false, error: "That person already works here through the business. Change their access from the Business team." }
    }
    return { ok: true }
}
