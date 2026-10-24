// app/api/team/members/[id]/route.ts
// The people in a shop or business. [id] is the assignment id.
//   PATCH { action: "set_role", roleId } | { action: "suspend" } | { action: "reinstate" }
//   DELETE   remove the person
// Rules, in order: you need the permission for that action at that level; you cannot change yourself
// (except leave); you cannot touch or create someone with more access than you hold; and a business
// or shop can never be left without an owner. Every change is audited, written to the activity feed
// in plain words, and the member is notified.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { assertTeamKeepsOwner, demoteIfNoLongerWorking, guardTeam, targetLabel, TeamError } from "@/lib/access/team-actions"
import { checkMemberAction, describeAction, nextStatus, parseMemberAction, roleUsableAt, type MemberAction } from "@/lib/access/team-rules"
import { notifications, notify, shopPublicIds } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

async function run(req: Request, id: string, action: MemberAction) {
    const member = await prisma.accessAssignment.findUnique({
        where: { id },
        select: {
            id: true, userId: true, scope: true, providerId: true, businessId: true, status: true,
            role: { select: { id: true, name: true, permissions: true } },
            user: { select: { name: true, email: true } },
        },
    })
    if (!member || member.scope === "PLATFORM") return NextResponse.json({ error: "Person not found" }, { status: 404 })
    const scope = member.scope

    const guard = await guardTeam(scope, action.type, req, { providerId: member.providerId, businessId: member.businessId })
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const roleRow =
        action.type === "set_role"
            ? await prisma.accessRole.findUnique({
                where: { id: action.roleId },
                select: { id: true, name: true, permissions: true, businessId: true, providerId: true },
            })
            : null
    // The new role must belong to this business, or to this shop (or its business, for a shop)
    const newRole =
        roleRow &&
            roleUsableAt(
                roleRow,
                scope === "SHOP"
                    ? { scope, providerId: member.providerId!, businessId: guard.businessId }
                    : { scope, businessId: member.businessId! }
            )
            ? roleRow
            : null
    if (action.type === "set_role" && !newRole) return NextResponse.json({ error: "Unknown role" }, { status: 400 })

    const check = checkMemberAction({
        actorUserId: guard.userId,
        targetUserId: member.userId,
        targetRolePermissions: member.role.permissions,
        newRolePermissions: newRole?.permissions,
        action,
        can: guard.can,
    })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    if (action.type === "reinstate" && member.status !== "SUSPENDED") {
        return NextResponse.json({ error: "That person is not suspended" }, { status: 400 })
    }
    if (action.type === "suspend" && member.status === "SUSPENDED") {
        return NextResponse.json({ error: "That person is already suspended" }, { status: 400 })
    }

    const levelId = (scope === "SHOP" ? member.providerId : member.businessId)!
    const label = await targetLabel(prisma, scope, levelId)
    const who = member.user.name || member.user.email
    const ownerTarget =
        scope === "SHOP"
            ? ({ scope, providerId: member.providerId!, businessId: guard.businessId } as const)
            : ({ scope, businessId: member.businessId! } as const)

    await withAudit(guard.actor, async (tx) => {
        // The owner rule runs inside the transaction, on fresh data
        if (action.type === "set_role" || action.type === "suspend" || action.type === "remove") {
            const owner = await assertTeamKeepsOwner(
                tx,
                ownerTarget,
                action.type === "set_role"
                    ? { type: "set_role", assignmentId: id, newPermissions: newRole?.permissions ?? [] }
                    : { type: action.type, assignmentId: id }
            )
            if (!owner.ok) throw new TeamError(owner.error, 409)
        }

        const shop = member.providerId ? (await shopPublicIds(tx, [member.providerId])).get(member.providerId) ?? null : null
        const entry = { entityType: "AccessAssignment", entityId: id, providerId: member.providerId } as const
        const verb = describeAction(action.type)

        if (action.type === "set_role" && newRole) {
            await tx.accessAssignment.update({ where: { id }, data: { roleId: newRole.id } })
            await logActivity(tx, guard.actor, {
                ...entry,
                action: "TEAM_ROLE_CHANGED",
                changes: [{ field: "role", from: member.role.name, to: newRole.name }],
                note: `${verb} ${who} in ${label}: ${member.role.name} to ${newRole.name}`,
            })
            await notify(tx, member.userId, notifications.teamRoleChanged({ where: label, role: newRole.name, shop }))
        } else if (action.type === "suspend" || action.type === "reinstate") {
            const status = nextStatus(action.type)!
            await tx.accessAssignment.update({ where: { id }, data: { status } })
            await logActivity(tx, guard.actor, {
                ...entry,
                action: action.type === "suspend" ? "TEAM_SUSPENDED" : "TEAM_REINSTATED",
                changes: [{ field: "status", from: member.status, to: status }],
                note: `${verb} ${who} in ${label}`,
            })
            await notify(
                tx,
                member.userId,
                action.type === "suspend" ? notifications.teamSuspended({ where: label }) : notifications.teamReinstated({ where: label, shop })
            )
        } else if (action.type === "remove") {
            await tx.accessAssignment.delete({ where: { id } })
            await logActivity(tx, guard.actor, {
                ...entry,
                action: "TEAM_REMOVED",
                changes: [{ field: "member", from: `${who} (${member.role.name})`, to: null }],
                note: `${verb} ${who} from ${label}`,
            })
            await notify(tx, member.userId, notifications.teamRemoved({ where: label }))
            await demoteIfNoLongerWorking(tx, member.userId)
        }
    })

    return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: Ctx) {
    try {
        const { id } = await params
        const parsed = parseMemberAction(await req.json().catch(() => null))
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        return await run(req, id, parsed.value)
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Change team member error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: Ctx) {
    try {
        const { id } = await params
        return await run(req, id, { type: "remove" })
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Remove team member error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
