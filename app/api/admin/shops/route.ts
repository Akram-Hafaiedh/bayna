// app/api/admin/shops/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const guard = await requirePlatform("shop.record.view", req)
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
        }

        const { searchParams } = new URL(req.url)
        const filter = searchParams.get("filter") // pending | verified | suspended | review | all

        const where =
            filter === "pending"
                ? { status: "PENDING" as const }
                : filter === "verified"
                    ? { status: "ACTIVE" as const }
                    : filter === "suspended"
                        ? { status: "SUSPENDED" as const }
                        : filter === "review"
                            ? { needsReview: true }
                            : {}

        const shops = await prisma.shop.findMany({
            where,
            include: {
                applicant: {
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

        return NextResponse.json({ shops })
    } catch (error) {
        console.error("Admin list shops error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
