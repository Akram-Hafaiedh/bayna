// app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST(req: Request) {
    try {
        const { email } = await req.json()

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { email },
        })

        // Always return success to avoid email enumeration
        if (!user) {
            return NextResponse.json({
                message: "If an account exists with this email, a reset link has been sent.",
            })
        }

        // Delete any existing tokens for this email
        await prisma.passwordResetToken.deleteMany({
            where: { email },
        })

        // Create a secure token
        const token = crypto.randomBytes(32).toString("hex")
        const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

        await prisma.passwordResetToken.create({
            data: {
                email,
                token,
                expires,
            },
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
