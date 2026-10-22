// app/api/admin/users/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const guard = await requirePlatform("user.account.view", req)
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true,
                providers: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        name: true,
                        isVerified: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ users })
    } catch (error) {
        console.error("Admin list users error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
