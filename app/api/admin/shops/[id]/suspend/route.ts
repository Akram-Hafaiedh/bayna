// app/api/admin/shops/[id]/suspend/route.ts
// The platform team suspends a shop (see lib/shop-status.ts). Needs shop.record.suspend.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { moveFor } from "@/lib/shops/shop-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("shop.record.suspend", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const shop = await prisma.shop.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } })
        if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

        const move = moveFor("suspend", shop.status)
        if (!move) return NextResponse.json({ error: "Only an active shop can be suspended" }, { status: 400 })

        const changed = await withAudit(guard.actor, (tx) =>
            tx.shop.updateMany({ where: { id, status: shop.status }, data: { status: move.to } })
        )
        if (changed.count === 0) return NextResponse.json({ error: "The shop was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: move.to })
    } catch (error) {
        console.error("Shop suspend error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
