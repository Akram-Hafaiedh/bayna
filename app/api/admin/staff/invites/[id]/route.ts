// app/api/admin/staff/invites/[id]/route.ts
// DELETE: cancel a pending staff invitation (the link stops working). Needs access.assignment.revoke, and you
// cannot cancel an invitation for a role with more access than yours.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { missingKeys } from "@/lib/access/team-rules"
import { staffPermission } from "@/lib/access/staff-rules"
import { STAFF_PLACE } from "@/lib/access/staff-actions"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform(staffPermission("remove"), req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const invite = await prisma.accessInvite.findUnique({
            where: { id },
            select: { id: true, scope: true, status: true, email: true, role: { select: { name: true, permissions: true } } },
        })
        if (!invite || invite.scope !== "PLATFORM") return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
        if (invite.status !== "PENDING") return NextResponse.json({ error: "That invitation is no longer pending" }, { status: 400 })
        if (missingKeys(invite.role.permissions, (k) => guard.can(k as never)).length > 0) {
            return NextResponse.json({ error: "You cannot cancel an invitation for a role with more access than your own." }, { status: 403 })
        }

        await withAudit(guard.actor, async (tx) => {
            await tx.accessInvite.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } })
            await logActivity(tx, guard.actor, {
                entityType: "AccessInvite",
                entityId: id,
                action: "STAFF_INVITE_CANCELLED",
                changes: [{ field: "invite", from: `${invite.email} as ${invite.role.name} in ${STAFF_PLACE}`, to: null }],
                note: `Cancelled the staff invitation for ${invite.email}`,
            })
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Cancel staff invite error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
