// app/api/notifications/route.ts
// The signed-in person's own notifications. No permission key: everyone reads only their own.
// GET ?limit=20 (max 50) returns the newest first, plus the number of unread ones.
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        const userId = session.user.id

        const asked = Number(new URL(req.url).searchParams.get("limit"))
        const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, 50) : 20

        const [items, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: limit,
                select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
            }),
            prisma.notification.count({ where: { userId, readAt: null } }),
        ])

        return NextResponse.json({ items, unreadCount })
    } catch (error) {
        console.error("List notifications error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
