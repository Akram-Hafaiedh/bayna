// lib/access/team-view.ts
// Turns the team data into what the team screens show: who the signed-in person may manage, which
// roles they may hand out. Pure (the permission test is passed in), shared by the shop Team page and
// the Business Team page.
import type { RoleChoice, TeamInviteView, TeamMemberView } from "@/components/provider/TeamSection"
import type { TeamInvite, TeamMember } from "./team"
import { OWNERSHIP_KEY, holdsKey } from "./catalogue"
import { assignableRoles, missingKeys } from "./team-rules"

type Can = (key: string) => boolean

export function toMemberView(m: TeamMember, can: Can, userId: string): TeamMemberView {
    const isYou = m.userId === userId
    return {
        id: m.id,
        name: m.name,
        email: m.email,
        roleId: m.roleId,
        roleName: m.roleName,
        status: m.status,
        accountClosed: m.accountClosed,
        since: m.since.toISOString(),
        isYou,
        // you may change someone whose access is not above yours (and look after your own entry)
        manageable: isYou || missingKeys(m.rolePermissions, can).length === 0,
    }
}

export function toInviteView(i: TeamInvite, roles: readonly { id: string; permissions: readonly string[] }[], can: Can): TeamInviteView {
    const role = roles.find((r) => r.id === i.roleId)
    return {
        id: i.id,
        email: i.email,
        roleId: i.roleId,
        roleName: i.roleName,
        state: i.state === "expired" ? "expired" : "pending",
        expiresAt: i.expiresAt.toISOString(),
        invitedByName: i.invitedByName,
        manageable: !role || missingKeys(role.permissions, can).length === 0,
    }
}

export function toRoleChoices(
    roles: readonly { id: string; label: string; description: string | null; permissions: readonly string[] }[],
    can: Can,
    level: "BUSINESS" | "SHOP"
): RoleChoice[] {
    return assignableRoles(roles, can).map((r) => ({
        id: r.id,
        name: r.label,
        description: r.description,
        // an owner-level role is never the default choice in the invite form
        isOwner: holdsKey(r.permissions, OWNERSHIP_KEY[level]),
    }))
}
