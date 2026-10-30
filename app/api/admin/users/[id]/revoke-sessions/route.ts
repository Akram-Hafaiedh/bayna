// app/api/admin/users/[id]/revoke-sessions/route.ts
// POST: signs the person out everywhere. The account and its password stay as they are.
// Needs user.credential.revoke_sessions.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { checkTarget } from "@/lib/users/user-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("user.credential.revoke_sessions", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const self = checkTarget(guard.userId, id)
        if (!self.ok) return NextResponse.json({ error: self.error }, { status: 400 })

        const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } })
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

        const result = await withAudit(guard.actor, (tx) =>
            tx.loginSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
        )
        return NextResponse.json({ revoked: result.count })
    } catch (error) {
        console.error("Revoke sessions error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
