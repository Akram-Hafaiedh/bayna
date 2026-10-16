// app/api/notifications/read/route.ts
// Mark the signed-in person's notifications as read.
// POST { ids: ["..."] } marks those, POST { all: true } marks every unread one.
// Only the person's own rows can be touched, whatever ids are sent.
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        const userId = session.user.id

        const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null
        const all = body?.all === true
        const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 100) : []
        if (!all && ids.length === 0) return NextResponse.json({ error: "Send ids or all: true" }, { status: 400 })

        const count = await withAudit(actorFromSession(session, requestMeta(req)), async (tx) => {
            const r = await tx.notification.updateMany({
                where: { userId, readAt: null, ...(all ? {} : { id: { in: ids } }) },
                data: { readAt: new Date() },
            })
            return r.count
        })

        const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } })
        return NextResponse.json({ marked: count, unreadCount })
    } catch (error) {
        console.error("Mark notifications read error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
