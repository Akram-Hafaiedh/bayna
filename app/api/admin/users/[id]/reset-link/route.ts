// app/api/admin/users/[id]/reset-link/route.ts
// POST: forces a password reset. The old password stops working, every session ends, and a one-time reset
// link is returned for the admin to pass on (there is no email service yet; the link is shown once).
// Needs user.credential.reset_password.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { newResetToken } from "@/lib/auth/reset-token"
import { checkTarget } from "@/lib/users/user-status"

const VALID_HOURS = 24

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("user.credential.reset_password", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const self = checkTarget(guard.userId, id)
        if (!self.ok) return NextResponse.json({ error: self.error }, { status: 400 })

        const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, email: true } })
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

        // Shown once to the admin; the table keeps only its hash
        const { token, hash } = newResetToken()
        const expires = new Date(Date.now() + VALID_HOURS * 60 * 60 * 1000)

        await withAudit(guard.actor, async (tx) => {
            // Only one link at a time: a new one replaces any earlier one
            await tx.passwordResetToken.deleteMany({ where: { email: user.email } })
            await tx.passwordResetToken.create({ data: { email: user.email, token: hash, expires } })
            await tx.user.update({ where: { id }, data: { password: null, passwordChangedAt: new Date() } })
            await tx.loginSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
        })

        const origin = process.env.AUTH_URL || new URL(req.url).origin
        return NextResponse.json({ url: `${origin}/reset-password?token=${token}`, expires: expires.toISOString() })
    } catch (error) {
        console.error("Reset link error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
