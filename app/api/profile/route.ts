// app/api/profile/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true,
            },
        })

        return NextResponse.json({ user })
    } catch (error) {
        console.error("Get profile error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { name, phone } = await req.json()

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: name ?? undefined,
                phone: phone ?? undefined,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
            },
        })

        return NextResponse.json({ user })
    } catch (error) {
        console.error("Update profile error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
