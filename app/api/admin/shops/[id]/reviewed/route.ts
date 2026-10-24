// app/api/admin/shops/[id]/reviewed/route.ts
// An admin has looked at a shop's changed name, address or location: clear the review flag.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { notifications, notify, shopPublicIds } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("shop.provider.update", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const provider = await prisma.shop.findUnique({ where: { id }, select: { id: true, userId: true, needsReview: true } })
        if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

        // Nothing to review (already cleared, for example by another admin): do not notify twice
        if (!provider.needsReview) return NextResponse.json({ message: "Already reviewed" })

        await withAudit(guard.actor, async (tx) => {
            await tx.shop.update({ where: { id }, data: { needsReview: false } })
            await notify(tx, provider.userId, notifications.profileReviewed({ shop: (await shopPublicIds(tx, [id])).get(id)! }))
        })
        return NextResponse.json({ message: "Marked as reviewed" })
    } catch (error) {
        console.error("Mark provider reviewed error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
