// app/api/admin/shops/[id]/reinstate/route.ts
// The platform team reinstates a shop (see lib/shops/shop-status.ts). Needs shop.record.reinstate.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { moveFor } from "@/lib/shops/shop-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("shop.record.reinstate", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const shop = await prisma.shop.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } })
        if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

        const move = moveFor("reinstate", shop.status)
        if (!move) return NextResponse.json({ error: "Only a suspended shop can be reinstated" }, { status: 400 })

        const changed = await withAudit(guard.actor, (tx) =>
            tx.shop.updateMany({ where: { id, status: shop.status }, data: { status: move.to } })
        )
        if (changed.count === 0) return NextResponse.json({ error: "The shop was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: move.to })
    } catch (error) {
        console.error("Shop reinstate error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
