// app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { hashResetToken } from "@/lib/reset-token"
import { RATE, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit"

export async function POST(req: Request) {
    try {
        // Stops guessing reset tokens one request after another
        const limited = await rateLimit(RATE.resetIp, clientIp(req))
        if (!limited.ok) return tooManyRequests(limited.retryAfterSec)

        const { token, password } = await req.json()

        if (typeof token !== "string" || typeof password !== "string" || !token || !password) {
            return NextResponse.json(
                { error: "Token and password are required" },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 }
            )
        }

        // The table keeps only the hash of the secret in the link
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token: hashResetToken(token) },
        })

        if (!resetToken || resetToken.expires < new Date()) {
            return NextResponse.json(
                { error: "Invalid or expired reset token" },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        // The reset link proves who this is, but there is no session, so the actor is named by email.
        const actor = actorFromSession(null, requestMeta(req), { actorName: resetToken.email })
        await withAudit(actor, async (tx) => {
            const user = await tx.user.update({
                where: { email: resetToken.email },
                data: { password: hashedPassword, passwordChangedAt: new Date() },
                select: { id: true },
            })
            // A new password ends every session opened with the old one
            await tx.loginSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })

            // Delete the used token
            await tx.passwordResetToken.delete({
                where: { token: resetToken.token },
            })
        })

        return NextResponse.json({
            message: "Password updated successfully",
        })
    } catch (error) {
        console.error("Reset password error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
