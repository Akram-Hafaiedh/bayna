// app/api/admin/users/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== Role.ADMIN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true,
                provider: {
                    select: {
                        id: true,
                        businessName: true,
                        isVerified: true,
                    },
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
