// app/api/admin/providers/[id]/reject/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("shop.application.reject", req)
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
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
        await withAudit(guard.actor, async (tx) => {
            await tx.provider.delete({ where: { id } })
            await tx.user.update({
                where: { id: provider.userId },
                data: { role: Role.CLIENT },
            })
        })

        return NextResponse.json({ message: "Provider application rejected" })
    } catch (error) {
        console.error("Reject provider error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
