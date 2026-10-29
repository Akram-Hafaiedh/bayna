// app/api/admin/impersonation/end/route.ts
// POST: the staff member leaves "view as" and is themselves again. Open to the viewing session itself (the page shows
// the viewed person, so the permission guards cannot be used here): auth() tells us which admin is behind it.
// Always clears the cookie, so a stale one cannot keep the app read-only.
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { logActivity, withAudit } from "@/lib/audit/run"
import { requestMeta } from "@/lib/audit/actor"
import { VIEW_AS_COOKIE } from "@/lib/impersonation"

export async function POST(req: Request) {
    try {
        const session = await auth()
        const view = session?.impersonation
        const res = NextResponse.json({ ok: true })
        res.cookies.set(VIEW_AS_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
        if (!session?.user?.id || !view) return res

        // The real admin ends it. Not read-only: closing the session is the one write a view may make.
        await withAudit({
            actorId: view.adminId, actorName: view.adminName, actorRole: "ADMIN", onBehalfOfId: session.user.id,
            impersonationId: view.id, source: "WEB", ...requestMeta(req),
        }, async (tx) => {
            const ended = await tx.impersonationSession.updateMany({
                where: { id: view.id, endedAt: null },
                data: { endedAt: new Date(), endedBy: "ADMIN" },
            })
            if (ended.count === 0) return
            await logActivity(tx, {
                actorId: view.adminId, actorName: view.adminName, actorRole: "ADMIN", onBehalfOfId: session.user.id,
                impersonationId: view.id, source: "WEB", ...requestMeta(req),
            }, { entityType: "User", entityId: session.user.id, action: "IMPERSONATION_END", note: "Stopped viewing the account" })
        })
        return res
    } catch (error) {
        console.error("End view-as error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
