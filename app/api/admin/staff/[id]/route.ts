// app/api/admin/staff/[id]/route.ts
// The people who work for Bayna. [id] is the assignment id.
//   PATCH { action: "set_role", roleId } | { action: "suspend" } | { action: "reinstate" }
//   DELETE   take the person off the staff
// Rules, in order: the permission (access.assignment.grant to change a role, .revoke for the rest); you cannot
// change your own access; you cannot touch or create someone with more access than you hold; and the platform
// always keeps a live owner. Every change is audited, written to the activity log and the person is notified.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { checkMemberAction, describeAction, nextStatus, parseMemberAction, type MemberAction } from "@/lib/access/team-rules"
import { isPlatformRole, staffPermission } from "@/lib/access/staff-rules"
import { STAFF_PLACE, assertStaffKeepsOwner, demoteIfNoLongerStaff } from "@/lib/access/staff-actions"
import { notifications, notify } from "@/lib/notifications"

class StaffError extends Error {
    constructor(message: string, public status: 400 | 403 | 409) {
        super(message)
    }
}

type Ctx = { params: Promise<{ id: string }> }
const toAdmin = <T extends { href?: string | null }>(n: T): T => ({ ...n, href: "/admin/dashboard" })

async function run(req: Request, id: string, action: MemberAction) {
    const guard = await requirePlatform(staffPermission(action.type), req)
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const member = await prisma.accessAssignment.findUnique({
        where: { id },
        select: {
            id: true, userId: true, scope: true, status: true,
            role: { select: { id: true, name: true, permissions: true } },
            user: { select: { name: true, email: true } },
        },
    })
    if (!member || member.scope !== "PLATFORM") return NextResponse.json({ error: "Person not found" }, { status: 404 })

    const newRole =
        action.type === "set_role"
            ? await prisma.accessRole.findUnique({
                where: { id: action.roleId },
                select: { id: true, name: true, permissions: true, businessId: true, shopId: true },
            })
            : null
    if (action.type === "set_role" && (!newRole || !isPlatformRole(newRole))) return NextResponse.json({ error: "Unknown role" }, { status: 400 })

    const check = checkMemberAction({
        actorUserId: guard.userId,
        targetUserId: member.userId,
        targetRolePermissions: member.role.permissions,
        newRolePermissions: newRole?.permissions,
        action,
        can: (k) => guard.can(k as never),
    })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    if (action.type === "reinstate" && member.status !== "SUSPENDED") return NextResponse.json({ error: "That person is not suspended" }, { status: 400 })
    if (action.type === "suspend" && member.status === "SUSPENDED") return NextResponse.json({ error: "That person is already suspended" }, { status: 400 })

    const who = member.user.name || member.user.email
    const entry = { entityType: "AccessAssignment", entityId: id } as const
    const verb = describeAction(action.type)

    await withAudit(guard.actor, async (tx) => {
        // The owner rule runs inside the transaction, on fresh data
        if (action.type === "set_role" || action.type === "suspend" || action.type === "remove") {
            const owner = await assertStaffKeepsOwner(
                tx,
                action.type === "set_role"
                    ? { type: "set_role", assignmentId: id, newPermissions: newRole?.permissions ?? [] }
                    : { type: action.type, assignmentId: id }
            )
            if (!owner.ok) throw new StaffError(owner.error, 409)
        }

        if (action.type === "set_role" && newRole) {
            await tx.accessAssignment.update({ where: { id }, data: { roleId: newRole.id } })
            await logActivity(tx, guard.actor, {
                ...entry,
                action: "STAFF_ROLE_CHANGED",
                changes: [{ field: "role", from: member.role.name, to: newRole.name }],
                note: `${verb} ${who} in ${STAFF_PLACE}: ${member.role.name} to ${newRole.name}`,
            })
            await notify(tx, member.userId, toAdmin(notifications.teamRoleChanged({ where: STAFF_PLACE, role: newRole.name })))
        } else if (action.type === "suspend" || action.type === "reinstate") {
            const status = nextStatus(action.type)!
            await tx.accessAssignment.update({ where: { id }, data: { status } })
            await logActivity(tx, guard.actor, {
                ...entry,
                action: action.type === "suspend" ? "STAFF_SUSPENDED" : "STAFF_REINSTATED",
                changes: [{ field: "status", from: member.status, to: status }],
                note: `${verb} ${who} in ${STAFF_PLACE}`,
            })
            await notify(
                tx,
                member.userId,
                toAdmin(action.type === "suspend" ? notifications.teamSuspended({ where: STAFF_PLACE }) : notifications.teamReinstated({ where: STAFF_PLACE }))
            )
        } else if (action.type === "remove") {
            await tx.accessAssignment.delete({ where: { id } })
            await logActivity(tx, guard.actor, {
                ...entry,
                action: "STAFF_REMOVED",
                changes: [{ field: "member", from: `${who} (${member.role.name})`, to: null }],
                note: `${verb} ${who} from ${STAFF_PLACE}`,
            })
            await notify(tx, member.userId, notifications.teamRemoved({ where: STAFF_PLACE }))
            await demoteIfNoLongerStaff(tx, member.userId)
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
        if (error instanceof StaffError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Change staff error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: Ctx) {
    try {
        const { id } = await params
        return await run(req, id, { type: "remove" })
    } catch (error) {
        if (error instanceof StaffError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Remove staff error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
