// lib/access/role-rules.ts
// The rules for creating, editing and deleting roles, kept pure so they are unit tested.
// Every role works the same way, so these rules do not care about a role's name:
//   - a role has a name (unique at its owner), a description and a list of permission keys
//   - "*" ("everything, now and later") is an ordinary choice, and then it is the only key
//   - nobody gives a role a key they do not hold themselves, and nobody edits or deletes a role that
//     holds keys they do not (a manager cannot touch the owner role)
//   - a role in use cannot be deleted: move its people to another role first
//   - changing a role must not leave the level without an owner (someone holding the ownership key)
import { fail, ok, type Parsed } from "@/lib/parse"
import { holdsKey, isKnownKey } from "./catalogue"
import { missingKeys } from "./team-rules"

export type RoleInput = { name: string; description: string | null; permissions: string[] }
export type RoleLevel = "BUSINESS" | "SHOP"

/** Body of POST /api/roles and PATCH /api/roles/[id]. */
export function parseRoleInput(body: unknown, level: RoleLevel): Parsed<RoleInput> {
    if (!body || typeof body !== "object") return fail("Send the role's name and permissions")
    const b = body as Record<string, unknown>

    if (typeof b.name !== "string") return fail("Give the role a name")
    const name = b.name.trim().replace(/\s+/g, " ")
    if (name.length < 2) return fail("The role name needs at least 2 characters")
    if (name.length > 60) return fail("The role name is too long (max 60 characters)")

    let description: string | null = null
    if (b.description !== undefined && b.description !== null) {
        if (typeof b.description !== "string") return fail("The description must be text")
        const d = b.description.trim()
        if (d.length > 200) return fail("The description is too long (max 200 characters)")
        description = d || null
    }

    if (!Array.isArray(b.permissions)) return fail("Choose the permissions")
    if (b.permissions.length > 600) return fail("Too many permissions")
    const keys: string[] = []
    for (const k of b.permissions) {
        if (typeof k !== "string") return fail("Unknown permission")
        if (!isKnownKey(level, k)) return fail(`Unknown permission: ${k}`)
        if (!keys.includes(k)) keys.push(k)
    }
    if (keys.length === 0) return fail("Choose at least one permission")
    const permissions = keys.includes("*") ? ["*"] : keys.sort()
    return ok({ name, description, permissions })
}

export type RoleCheck = { ok: true } | { ok: false; error: string; status: 403 }

/**
 * May the actor save this role? `existing` is the role's current permissions when editing (null when
 * creating). `can` is what the actor holds at the role's owner.
 */
export function checkRoleChange(input: { can: (key: string) => boolean; existing: readonly string[] | null; next: readonly string[] }): RoleCheck {
    const { can, existing, next } = input
    if (existing && missingKeys(existing, can).length > 0) {
        return { ok: false, error: "You cannot change a role that has more access than you do.", status: 403 }
    }
    // Keys the role already had stay: only NEW keys must be ones the actor holds
    const added = next.filter((k) => !existing?.includes(k))
    if (missingKeys(added, can).length > 0) {
        return { ok: false, error: "You cannot give a role more access than you have yourself.", status: 403 }
    }
    return { ok: true }
}

/** May the actor delete this role? Same "not above you" rule as editing. */
export function checkRoleDelete(input: { can: (key: string) => boolean; permissions: readonly string[] }): RoleCheck {
    if (missingKeys(input.permissions, input.can).length > 0) {
        return { ok: false, error: "You cannot delete a role that has more access than you do.", status: 403 }
    }
    return { ok: true }
}

/** The message when a role is still in use, or null when it can go. */
export function roleInUseMessage(usage: { members: number; invites: number }): string | null {
    const parts: string[] = []
    if (usage.members > 0) parts.push(`${usage.members} ${usage.members === 1 ? "person has" : "people have"} this role`)
    if (usage.invites > 0) parts.push(`${usage.invites} ${usage.invites === 1 ? "invitation uses" : "invitations use"} it`)
    if (parts.length === 0) return null
    return `${parts.join(" and ")}. Move them to another role first (Team page), then delete it.`
}

export type RoleMember = {
    roleId: string
    permissions: readonly string[]
    /** active, unexpired, and the person's account is open */
    live: boolean
}

/**
 * Would saving `newPermissions` on `roleId` leave the level without a live owner? Fails only when the
 * level HAS a live owner today and none would be left. (If it has none already, there is nothing to protect.)
 */
export function checkRoleEditKeepsOwner(
    members: readonly RoleMember[],
    roleId: string,
    newPermissions: readonly string[],
    ownershipKey: string
): { ok: true } | { ok: false; error: string } {
    const holders = (permissionsOf: (m: RoleMember) => readonly string[]) =>
        members.filter((m) => m.live && holdsKey(permissionsOf(m), ownershipKey)).length
    const before = holders((m) => m.permissions)
    const after = holders((m) => (m.roleId === roleId ? newPermissions : m.permissions))
    if (before > 0 && after === 0) {
        return { ok: false, error: "That would leave nobody who can transfer ownership. Keep the ownership permission, or give it to another role first." }
    }
    return { ok: true }
}
