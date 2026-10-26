// app/api/admin/users/[id]/suspend/route.ts
// POST { reason }: the platform team suspends an account. The person cannot sign in and every open
// session ends at once. Needs user.account.suspend. The reason is kept in the activity log.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { checkTarget, parseReason, userMove } from "@/lib/user-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("user.account.suspend", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const self = checkTarget(guard.userId, id)
        if (!self.ok) return NextResponse.json({ error: self.error }, { status: 400 })

        const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } })
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

        const next = userMove("suspend", user.status)
        if (!next) return NextResponse.json({ error: "Only an active account can be suspended" }, { status: 400 })

        const body = (await req.json().catch(() => null)) as { reason?: unknown } | null
        const reason = parseReason(body?.reason)
        if (!reason.ok) return NextResponse.json({ error: reason.error }, { status: 400 })

        const done = await withAudit(guard.actor, async (tx) => {
            const changed = await tx.user.updateMany({
                where: { id, status: user.status },
                data: { status: next, suspendedReason: reason.value },
            })
            if (changed.count === 0) return false
            await tx.loginSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
            return true
        })
        if (!done) return NextResponse.json({ error: "The account was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: next })
    } catch (error) {
        console.error("Suspend user error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
