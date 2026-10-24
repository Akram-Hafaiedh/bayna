// app/api/team/invites/[id]/route.ts
// DELETE: cancel a pending invitation (the link stops working). Same permission as inviting, and you
// cannot cancel an invitation for a role with more access than yours.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { guardTeam, targetLabel } from "@/lib/access/team-actions"
import { missingKeys } from "@/lib/access/team-rules"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const invite = await prisma.accessInvite.findUnique({
            where: { id },
            select: {
                id: true, scope: true, providerId: true, businessId: true, status: true, email: true,
                role: { select: { name: true, permissions: true } },
            },
        })
        if (!invite || invite.scope === "PLATFORM") return NextResponse.json({ error: "Invitation not found" }, { status: 404 })

        const guard = await guardTeam(invite.scope, "invite", req, { providerId: invite.providerId, businessId: invite.businessId })
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        if (invite.status !== "PENDING") {
            return NextResponse.json({ error: "That invitation is no longer pending" }, { status: 400 })
        }
        if (missingKeys(invite.role.permissions, guard.can).length > 0) {
            return NextResponse.json({ error: "You cannot cancel an invitation for a role with more access than your own." }, { status: 403 })
        }

        const label = await targetLabel(prisma, invite.scope, (invite.providerId ?? invite.businessId)!)
        await withAudit(guard.actor, async (tx) => {
            await tx.accessInvite.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } })
            await logActivity(tx, guard.actor, {
                entityType: "AccessInvite",
                entityId: id,
                providerId: invite.providerId,
                action: "TEAM_INVITE_CANCELLED",
                changes: [{ field: "invite", from: `${invite.email} as ${invite.role.name} in ${label}`, to: null }],
                note: `Cancelled the invitation for ${invite.email}`,
            })
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Cancel invite error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
