// app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { newResetToken } from "@/lib/reset-token"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { parseEmail } from "@/lib/email-input"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const parsedEmail = parseEmail(body?.email)
        if (!parsedEmail.ok) {
            return NextResponse.json({ error: parsedEmail.error }, { status: 400 })
        }

        // Case-insensitive, so accounts saved before emails were normalised can still reset
        const user = await prisma.user.findFirst({
            where: { email: { equals: parsedEmail.value, mode: "insensitive" } },
        })

        // Always return success to avoid email enumeration
        if (!user) {
            return NextResponse.json({
                message: "If an account exists with this email, a reset link has been sent.",
            })
        }

        // The token carries the address exactly as stored on the account
        const email = user.email

        // Create a secure token; only its hash is stored
        const { token, hash } = newResetToken()
        const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

        // Anyone can request a reset, so there is no signed-in person; the request's IP and
        // browser are recorded instead.
        await withAudit(actorFromSession(null, requestMeta(req)), async (tx) => {
            // Delete any existing tokens for this email
            await tx.passwordResetToken.deleteMany({
                where: { email },
            })
            await tx.passwordResetToken.create({
                data: {
                    email,
                    token: hash,
                    expires,
                },
            })
        })

        // In development we just log the link.
        // Later we will send a real email (Resend / Nodemailer).
        const resetUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`

        console.log("========================================")
        console.log("PASSWORD RESET LINK (dev only):")
        console.log(resetUrl)
        console.log("========================================")

        return NextResponse.json({
            message: "If an account exists with this email, a reset link has been sent.",
        })
    } catch (error) {
        console.error("Forgot password error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
