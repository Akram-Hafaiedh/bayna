// app/api/admin/providers/[id]/reject/route.ts
// WORKSPACE NOTE: folder is named _id here — rename to [id] in your local project
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

        // Remove application; keep user as CLIENT
        await prisma.$transaction([
            prisma.provider.delete({ where: { id } }),
            prisma.user.update({
                where: { id: provider.userId },
                data: { role: Role.CLIENT },
            }),
        ])

        return NextResponse.json({ message: "Provider application rejected" })
    } catch (error) {
        console.error("Reject provider error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
