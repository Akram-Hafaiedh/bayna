// app/api/admin/impersonation/[id]/end/route.ts
// POST: a staff member closes someone else's open "view as" session at once (the emergency button). Needs
// impersonation.session.end_any. The viewing staff member's next page load is theirs again; a leftover cookie is
// cleared by the banner (components/admin/ViewAsBanner.tsx). Ending your own is done with Exit.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { logActivity, withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("impersonation.session.end_any", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const session = await prisma.impersonationSession.findUnique({
            where: { id },
            select: { id: true, adminId: true, targetUserId: true },
        })
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        if (session.adminId === guard.userId) {
            return NextResponse.json({ error: "This is your own view. Use Exit on the yellow bar." }, { status: 400 })
        }

        const done = await withAudit(guard.actor, async (tx) => {
            const ended = await tx.impersonationSession.updateMany({
                where: { id, endedAt: null },
                data: { endedAt: new Date(), endedBy: "STAFF" },
            })
            if (ended.count === 0) return false
            await logActivity(tx, { ...guard.actor, onBehalfOfId: null }, {
                entityType: "User", entityId: session.targetUserId, action: "IMPERSONATION_END",
                note: "A view of this account was ended by another staff member",
            })
            return true
        })
        if (!done) return NextResponse.json({ error: "That view has already ended" }, { status: 409 })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("End any view-as error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
