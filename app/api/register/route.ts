// app/api/register/route.ts
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { Role } from "@/app/generated/prisma/enums"
import { parseEmail } from "@/lib/email-input"
import { parseAcceptance } from "@/lib/terms"
import { RATE, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit"

export async function POST(req: Request) {
    try {
        const limited = await rateLimit(RATE.registerIp, clientIp(req))
        if (!limited.ok) return tooManyRequests(limited.retryAfterSec)

        const body = await req.json()
        const { password, name } = body

        const parsedEmail = parseEmail(body.email)
        if (!parsedEmail.ok) {
            return NextResponse.json({ error: parsedEmail.error }, { status: 400 })
        }
        const email = parsedEmail.value

        // The Terms and the Privacy policy must be accepted, and what was accepted is kept with the account
        const accepted = parseAcceptance(body.acceptTerms)
        if (!accepted.ok) {
            return NextResponse.json({ error: accepted.error }, { status: 400 })
        }

        if (!password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 }
            )
        }

        // Check if user already exists
        // Case-insensitive, so an old account saved as "Sami@Mail.com" still counts
        const existingUser = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
        })

        if (existingUser) {
            return NextResponse.json(
                { error: "Email already in use" },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        // Always create as CLIENT — never trust role from the client
        // Nobody is signed in yet, so the new account is named as the actor by its email.
        const actor = actorFromSession(null, requestMeta(req), { actorName: email, actorRole: Role.CLIENT })
        const user = await withAudit(actor, (tx) =>
            tx.user.create({
                data: {
                    email,
                    name: name || null,
                    password: hashedPassword,
                    role: Role.CLIENT,
                    termsAcceptedAt: new Date(),
                    termsVersion: accepted.version,
                },
            })
        )

        return NextResponse.json(
            { message: "User created successfully", userId: user.id },
            { status: 201 }
        )
    } catch (error) {
        console.error("Register error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
