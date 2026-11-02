// app/api/shop/products/[id]/price-history/route.ts
// GET the price history of a product, newest first. Needs product.listing.view.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { listPriceHistory } from "@/lib/pricing/price-history"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const guard = await requireShop("product.listing.view", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const history = await listPriceHistory(guard.shop.id, id)
        if (!history) return bad("Product not found", 404)
        return NextResponse.json(history)
    } catch (error) {
        console.error("Price history error:", error)
        return bad("Something went wrong", 500)
    }
}
