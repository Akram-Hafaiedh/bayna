// app/api/profile/sessions/revoke-others/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const currentSessionId = (session as { loginSessionId?: string }).loginSessionId

        await prisma.loginSession.updateMany({
            where: {
                userId: session.user.id,
                revokedAt: null,
                ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}),
            },
            data: { revokedAt: new Date() },
        })

        return NextResponse.json({ message: "Other sessions revoked" })
    } catch (error) {
        console.error("Revoke sessions error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
