// app/api/business/shops/[publicShopId]/status/route.ts
// POST { action: "submit" | "close" | "reopen" }: the owners' moves in a shop's life (see lib/shops/shop-status.ts).
// Approving, suspending and reinstating belong to the platform team (/api/admin/shops/[id]/...).
// Needs business.shop.change_status in the shop's business. Written to the activity log by withAudit.
import { NextResponse } from "next/server"
import { requireBusiness } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { moveFor, type ShopAction } from "@/lib/shops/shop-status"

const OWNER_ACTIONS: ShopAction[] = ["submit", "close", "reopen"]

export async function POST(req: Request, { params }: { params: Promise<{ publicShopId: string }> }) {
    try {
        const { publicShopId } = await params
        const shop = await prisma.shop.findFirst({
            where: { publicShopId, deletedAt: null },
            select: { id: true, businessId: true, status: true },
        })
        // Same answer for "no such shop" and "not yours", so a public id says nothing
        if (!shop) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const guard = await requireBusiness("business.shop.change_status", req, { businessId: shop.businessId })
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const body = (await req.json().catch(() => null)) as { action?: unknown } | null
        const action = OWNER_ACTIONS.find((a) => a === body?.action)
        if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 })

        const move = moveFor(action, shop.status)
        if (!move) return NextResponse.json({ error: "That is not possible while the shop is in its current status" }, { status: 400 })

        // Compare with the status read above, so two people clicking at once do not both win
        const changed = await withAudit(guard.actor, (tx) =>
            tx.shop.updateMany({ where: { id: shop.id, status: shop.status }, data: { status: move.to } })
        )
        if (changed.count === 0) return NextResponse.json({ error: "The shop was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: move.to })
    } catch (error) {
        console.error("Shop status error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
