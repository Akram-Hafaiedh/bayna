// app/api/admin/providers/[id]/approve/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== Role.ADMIN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        const provider = await prisma.provider.findUnique({
            where: { id },
        })

        if (!provider) {
            return NextResponse.json(
                { error: "Provider not found" },
                { status: 404 }
            )
        }

        await prisma.$transaction([
            prisma.provider.update({
                where: { id },
                data: { isVerified: true },
            }),
            prisma.user.update({
                where: { id: provider.userId },
                data: { role: Role.PROVIDER },
            }),
        ])

        return NextResponse.json({ message: "Provider approved" })
    } catch (error) {
        console.error("Approve provider error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}