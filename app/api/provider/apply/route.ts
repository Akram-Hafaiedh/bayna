// app/api/provider/apply/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { Role } from "@/app/generated/prisma/enums"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userId = session.user.id

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { provider: true },
        })

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        if (user.role === Role.ADMIN) {
            return NextResponse.json(
                { error: "Admin accounts cannot become providers" },
                { status: 400 }
            )
        }

        if (user.role === Role.PROVIDER) {
            return NextResponse.json(
                { error: "You are already a provider" },
                { status: 400 }
            )
        }

        // Pending application already exists
        if (user.provider) {
            return NextResponse.json(
                {
                    error: user.provider.isVerified
                        ? "You are already a provider"
                        : "You already have a pending application",
                },
                { status: 400 }
            )
        }

        const body = await req.json()
        const {
            businessName,
            description,
            phone,
            address,
            city,
            governorate,
        } = body

        if (!businessName?.trim() || !city?.trim()) {
            return NextResponse.json(
                { error: "Business name and city are required" },
                { status: 400 }
            )
        }

        // Create provider profile only — role stays CLIENT until admin approves
        const provider = await withAudit(actorFromSession(session, requestMeta(req)), (tx) =>
            tx.provider.create({
                data: {
                    userId,
                    businessName: businessName.trim(),
                    description: description?.trim() || null,
                    phone: phone?.trim() || user.phone || null,
                    address: address?.trim() || null,
                    city: city.trim(),
                    governorate: governorate?.trim() || null,
                    isVerified: false,
                },
            })
        )

        return NextResponse.json(
            {
                message: "Application submitted. Waiting for admin approval.",
                providerId: provider.id,
                status: "pending",
            },
            { status: 201 }
        )
    } catch (error) {
        console.error("Become provider error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}

// GET — current user's application status
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const provider = await prisma.provider.findUnique({
            where: { userId: session.user.id },
        })

        if (!provider) {
            return NextResponse.json({ status: "none" })
        }

        return NextResponse.json({
            status: provider.isVerified ? "approved" : "pending",
            provider,
        })
    } catch (error) {
        console.error("Get provider status error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
