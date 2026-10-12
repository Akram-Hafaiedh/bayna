// app/api/admin/providers/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

async function requireAdmin() {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== Role.ADMIN) {
        return null
    }
    return session
}

export async function GET(req: Request) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const filter = searchParams.get("filter") // pending | verified | all

        const where =
            filter === "pending"
                ? { isVerified: false }
                : filter === "verified"
                  ? { isVerified: true }
                  : {}

        const providers = await prisma.provider.findMany({
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
