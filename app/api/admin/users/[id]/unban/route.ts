// app/api/admin/users/[id]/unban/route.ts
// POST: the platform team lifts a ban. The account can sign in again (the person has to sign in again: their
// old sessions stay ended). Needs user.account.reinstate.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { checkTarget, userMove } from "@/lib/user-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("user.account.reinstate", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const self = checkTarget(guard.userId, id)
        if (!self.ok) return NextResponse.json({ error: self.error }, { status: 400 })

        const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } })
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

        const next = userMove("unban", user.status)
        if (!next) return NextResponse.json({ error: "Only a banned account can be unbanned" }, { status: 400 })

        const changed = await withAudit(guard.actor, (tx) =>
            tx.user.updateMany({ where: { id, status: user.status }, data: { status: next, suspendedReason: null } })
        )
        if (changed.count === 0) return NextResponse.json({ error: "The account was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: next })
    } catch (error) {
        console.error("Unban user error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
