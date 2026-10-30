// app/api/admin/users/[id]/ban/route.ts
// POST { reason }: the platform team bans an account (an active or a suspended one). The person cannot sign in,
// every open session ends at once, and the email stays taken, so they cannot register again with it. Needs
// user.account.suspend (a ban is a suspension that is meant to last). The reason is kept in the activity log.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { assertPlatformKeepsAnOwner } from "@/lib/access/owners"
import { checkTarget, parseReason, userMove } from "@/lib/users/user-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("user.account.suspend", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const self = checkTarget(guard.userId, id)
        if (!self.ok) return NextResponse.json({ error: self.error }, { status: 400 })

        const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } })
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

        const next = userMove("ban", user.status)
        if (!next) return NextResponse.json({ error: "Only an active or a suspended account can be banned" }, { status: 400 })

        const body = (await req.json().catch(() => null)) as { reason?: unknown } | null
        const reason = parseReason(body?.reason, "banned")
        if (!reason.ok) return NextResponse.json({ error: reason.error }, { status: 400 })

        const done = await withAudit(guard.actor, async (tx) => {
            // The platform always keeps a live owner: the last Super admin cannot be banned
            const rule = await assertPlatformKeepsAnOwner(tx, id)
            if (!rule.ok) return { kind: "owner" as const, error: rule.error }
            const changed = await tx.user.updateMany({
                where: { id, status: user.status },
                data: { status: next, suspendedReason: reason.value },
            })
            if (changed.count === 0) return { kind: "race" as const }
            await tx.loginSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
            return { kind: "done" as const }
        })
        if (done.kind === "owner") return NextResponse.json({ error: done.error }, { status: 400 })
        if (done.kind === "race") return NextResponse.json({ error: "The account was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: next })
    } catch (error) {
        console.error("Ban user error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
