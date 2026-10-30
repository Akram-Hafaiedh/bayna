// app/api/admin/products/[id]/block/route.ts
// The platform team blocks a product listing (see lib/product-status.ts). Needs product.listing.hide.
// A blocked product is out of sale and the shop cannot list it again; unblocking returns it as a draft.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { platformMove } from "@/lib/products/product-status"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("product.listing.hide", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const product = await prisma.product.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } })
        if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

        const next = platformMove("block", product.status)
        if (!next) return NextResponse.json({ error: "block" === "block" ? "This product is already blocked" : "This product is not blocked" }, { status: 400 })

        const changed = await withAudit(guard.actor, (tx) =>
            tx.product.updateMany({ where: { id, status: product.status }, data: { status: next } })
        )
        if (changed.count === 0) return NextResponse.json({ error: "The product was just changed by someone else. Refresh and try again." }, { status: 409 })

        return NextResponse.json({ status: next })
    } catch (error) {
        console.error("Product block error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
