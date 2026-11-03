// app/api/shop/stock/reorder/route.ts
// PATCH { productId, warehouseId, reorderPoint }: the quantity at or below which a product counts as low in a
// warehouse (0 or more; null clears it). Needs inventory.adjustment.create.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { setReorderPoint, StockError } from "@/lib/inventory/stock-actions"
import { productIdOf, warehouseIdOf } from "@/lib/shared/resolve-public"
import { parseCount } from "@/lib/inventory/stock-rules"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: Request) {
    try {
        const guard = await requireShop("inventory.adjustment.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
        if (!b || typeof b !== "object" || Array.isArray(b)) return bad("Invalid request")
        if (typeof b.productId !== "string" || !b.productId) return bad("Choose a product")
        if (typeof b.warehouseId !== "string" || !b.warehouseId) return bad("Choose a warehouse")
        let point: number | null = null
        if (b.reorderPoint !== null && b.reorderPoint !== "") {
            const r = parseCount(b.reorderPoint, "The reorder point")
            if (!r.ok) return bad(r.error)
            point = r.value
        }
        const productId = await productIdOf(guard.shop.id, b.productId)
        if (!productId) return bad("Product not found", 404)
        const warehouseId = await warehouseIdOf(guard.shop.id, b.warehouseId)
        if (!warehouseId) return bad("Warehouse not found", 404)
        await withAudit(guard.actor, (tx) =>
            setReorderPoint(tx, { shopId: guard.shop.id, productId, warehouseId, reorderPoint: point })
        )
        return NextResponse.json({ message: "Saved" })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Reorder point error:", error)
        return bad("Something went wrong", 500)
    }
}
