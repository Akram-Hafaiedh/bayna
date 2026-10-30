// app/api/profile/delete/route.ts
// POST { password }: the signed-in person asks to delete their own account. Their password is checked again. The
// account becomes PENDING_DELETION, every session ends, and GRACE_DAYS later `npm run db:purge-accounts`
// anonymises it. Signing in again before then cancels it (auth.ts). Refused while they are the only owner of a
// shop, a business or the platform, or have a shop application waiting (the answer lists what to do first).
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { checkCanRequest, parseDeletionRequest, purgeDate } from "@/lib/users/account-deletion"
import { deletionBlockers } from "@/lib/users/account-deletion-actions"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const parsed = parseDeletionRequest(await req.json().catch(() => null))
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

        const user = await prisma.user.findFirst({
            where: { id: session.user.id, deletedAt: null },
            select: { id: true, status: true, password: true },
        })
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        if (!user.password) return NextResponse.json({ error: "Password login is not available for this account" }, { status: 400 })
        if (!(await bcrypt.compare(parsed.value.password, user.password))) {
            return NextResponse.json({ error: "Password is incorrect" }, { status: 400 })
        }

        const actor = actorFromSession(session, requestMeta(req))
        const now = new Date()
        const done = await withAudit(actor, async (tx) => {
            const blockers = await deletionBlockers(tx, user.id, now)
            const can = checkCanRequest({ status: user.status, blockers })
            if (!can.ok) return { ok: false as const, error: can.error, blockers: can.blockers }
            const changed = await tx.user.updateMany({
                where: { id: user.id, status: "ACTIVE" },
                data: { status: "PENDING_DELETION", deletionRequestedAt: now },
            })
            if (changed.count === 0) return { ok: false as const, error: "This account cannot be deleted right now", blockers: [] as string[] }
            await tx.loginSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } })
            await logActivity(tx, actor, { entityType: "User", entityId: user.id, action: "ACCOUNT_DELETION_REQUESTED", note: "Asked to delete their account" })
            return { ok: true as const }
        })
        if (!done.ok) return NextResponse.json({ error: done.error, blockers: done.blockers }, { status: 400 })

        return NextResponse.json({ status: "PENDING_DELETION", purgeOn: purgeDate(now).toISOString() })
    } catch (error) {
        console.error("Delete account error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
