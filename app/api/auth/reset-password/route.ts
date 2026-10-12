// app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
    try {
        const { token, password } = await req.json()

        if (!token || !password) {
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

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        })

        if (!resetToken || resetToken.expires < new Date()) {
            return NextResponse.json(
                { error: "Invalid or expired reset token" },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        await prisma.user.update({
            where: { email: resetToken.email },
            data: { password: hashedPassword },
        })

        // Delete the used token
        await prisma.passwordResetToken.delete({
            where: { token },
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
