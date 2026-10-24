// app/api/admin/providers/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const guard = await requirePlatform("shop.provider.view", req)
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
        }

        const { searchParams } = new URL(req.url)
        const filter = searchParams.get("filter") // pending | verified | review | all

        const where =
            filter === "pending"
                ? { isVerified: false }
                : filter === "verified"
                    ? { isVerified: true }
                    : filter === "review"
                        ? { needsReview: true }
                        : {}

        const providers = await prisma.shop.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ providers })
    } catch (error) {
        console.error("Admin list providers error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
