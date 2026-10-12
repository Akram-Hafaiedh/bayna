// app/api/profile/sessions/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const currentSessionId = (session as { loginSessionId?: string }).loginSessionId

        const sessions = await prisma.loginSession.findMany({
            where: {
                userId: session.user.id,
                revokedAt: null,
            },
            orderBy: { lastActiveAt: "desc" },
        })

        return NextResponse.json({
            sessions: sessions.map((s) => ({
                id: s.id,
                deviceLabel: s.deviceLabel || "Unknown device",
                userAgent: s.userAgent,
                ip: s.ip,
                createdAt: s.createdAt,
                lastActiveAt: s.lastActiveAt,
                isCurrent: s.id === currentSessionId,
            })),
        })
    } catch (error) {
        console.error("List sessions error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
