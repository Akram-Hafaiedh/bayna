// app/api/profile/sessions/revoke-others/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const currentSessionId = (session as { loginSessionId?: string }).loginSessionId

        const userId = session.user.id
        await withAudit(actorFromSession(session, requestMeta(req)), (tx) =>
            tx.loginSession.updateMany({
                where: {
                    userId,
                    revokedAt: null,
                    ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}),
                },
                data: { revokedAt: new Date() },
            })
        )

        return NextResponse.json({ message: "Other sessions revoked" })
    } catch (error) {
        console.error("Revoke sessions error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
