// lib/access/staff-rules.ts
// The rules of the Staff page (the people who work for Bayna itself: Super admin, Admin, Support agent ...).
// Pure, so every refusal is unit tested. They sit on top of the team rules (team-rules.ts): nobody gives
// or changes access they do not hold themselves, and nobody changes their own access. On top of that:
//   - a role given here must be a platform role (never a shop or business role);
//   - an account that works in a shop or a business cannot also be staff (it would need two dashboards,
//     and the sign-in routes by one account type), so staff get their own account;
//   - the platform always keeps one live owner (the person who can hand out access).
import { fail, ok, type Parsed } from "@/lib/shared/parse"
import { parseEmail } from "@/lib/auth/email-input"
import { OWNERSHIP_KEY } from "./catalogue"
import { checkOwnerRule, platformMembers, type OwnerCheck, type StaffRow } from "./owners"
import type { MemberAction } from "./team-rules"

const ID = /^[A-Za-z0-9_-]{1,64}$/

export type StaffInvite = { email: string; roleId: string }

/** Body of POST /api/admin/staff/invites. */
export function parseStaffInvite(body: unknown): Parsed<StaffInvite> {
    if (!body || typeof body !== "object") return fail("Send the person's email and a role")
    const b = body as Record<string, unknown>
    const email = parseEmail(b.email)
    if (!email.ok) return fail(email.error)
    if (typeof b.roleId !== "string" || !ID.test(b.roleId)) return fail("Choose a role")
    return ok({ email: email.value, roleId: b.roleId })
}

/** A platform role has no business and no shop. */
export const isPlatformRole = (role: { businessId: string | null; shopId: string | null }) =>
    role.businessId === null && role.shopId === null

export const STAFF_ACCOUNT_ERROR =
    "This account works in a shop or a business, so it cannot also be platform staff. Use a separate account for staff work."

/** May this account become staff? Not when it runs or works in a shop or business. */
export function checkStaffAccount(input: { worksInShopOrBusiness: boolean; ownsAShop: boolean }): { ok: true } | { ok: false; error: string } {
    return input.worksInShopOrBusiness || input.ownsAShop ? { ok: false, error: STAFF_ACCOUNT_ERROR } : { ok: true }
}

/** The permission that opens each action on the Staff page. */
export function staffPermission(action: MemberAction["type"] | "invite" | "view"): "access.assignment.view" | "access.assignment.grant" | "access.assignment.revoke" {
    if (action === "view") return "access.assignment.view"
    if (action === "invite" || action === "set_role") return "access.assignment.grant"
    return "access.assignment.revoke"
}

/** Who an invitation may go to. `existing`: the account with this email, if there is one. */
export function checkStaffInvitee(input: {
    inviteeEmail: string
    actorEmail: string | null
    existing: { status: string; alreadyStaff: boolean } | null
}): { ok: true } | { ok: false; error: string } {
    if (input.actorEmail && input.actorEmail.toLowerCase() === input.inviteeEmail.toLowerCase()) {
        return { ok: false, error: "That is your own address" }
    }
    if (input.existing) {
        if (input.existing.status !== "ACTIVE") return { ok: false, error: "That account is not active" }
        if (input.existing.alreadyStaff) return { ok: false, error: "That person is already on the staff. Change their role from the list instead." }
    }
    return { ok: true }
}

export type StaffAssignmentRow = StaffRow & { id: string }

export type StaffChange =
    | { type: "remove"; assignmentId: string }
    | { type: "suspend"; assignmentId: string }
    | { type: "set_role"; assignmentId: string; newPermissions: readonly string[] }

/**
 * Would this change leave the platform without a live owner? Works per person: a person with two roles
 * is one owner. Applies the change to a copy of the rows, then asks the same owner rule as everywhere else.
 * A change to someone who is not a live owner always passes.
 */
export function checkStaffOwnerRule(rows: readonly StaffAssignmentRow[], change: StaffChange, now: Date = new Date()): OwnerCheck {
    const target = rows.find((r) => r.id === change.assignmentId)
    if (!target) return { ok: false, error: "That person is not on the staff" }

    const after: StaffRow[] = rows.flatMap((r) => {
        if (r.id !== change.assignmentId) return [r]
        if (change.type === "remove") return []
        if (change.type === "suspend") return [{ ...r, status: "SUSPENDED" as const }]
        return [{ ...r, role: { permissions: change.newPermissions } }]
    })

    const key = OWNERSHIP_KEY.PLATFORM
    const before = platformMembers(rows, key, now)
    const member = before.find((m) => m.id === target.userId)
    if (!(member?.live && member.holdsOwnership)) return { ok: true }

    // The same question as for any level, asked of the people left once the change is made
    const left = platformMembers(after, key, now)
    const stillOwner = left.filter((m) => m.live && m.holdsOwnership)
    if (stillOwner.length > 0) return { ok: true }
    // Reuse the standard wording by asking the rule about a one-owner level
    return checkOwnerRule([{ id: target.userId, holdsOwnership: true, live: true }], { type: "remove", assignmentId: target.userId }, key)
}
