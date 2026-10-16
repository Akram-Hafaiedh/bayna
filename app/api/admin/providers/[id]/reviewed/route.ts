// app/api/admin/providers/[id]/reviewed/route.ts
// An admin has looked at a shop's changed name, address or location: clear the review flag.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("shop.provider.update", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const provider = await prisma.provider.findUnique({ where: { id }, select: { id: true } })
        if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

        await withAudit(guard.actor, (tx) =>
            tx.provider.update({ where: { id }, data: { needsReview: false } })
        )
        return NextResponse.json({ message: "Marked as reviewed" })
    } catch (error) {
        console.error("Mark provider reviewed error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
