// app/api/shop/stock/transfer/route.ts
// POST { productId, fromId, toId, quantity, reason? }: move stock between two warehouses of the shop
// (inventory.transfer.create). Two ledger rows share one transfer id.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { StockError, transferStock } from "@/lib/inventory/stock-actions"
import { parseQuantity, parseReason } from "@/lib/inventory/stock-rules"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
    try {
        const guard = await requireShop("inventory.transfer.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
        if (!b || typeof b !== "object" || Array.isArray(b)) return bad("Invalid request")
        if (typeof b.productId !== "string" || !b.productId) return bad("Choose a product")
        if (typeof b.fromId !== "string" || !b.fromId) return bad("Choose the warehouse to take stock from")
        if (typeof b.toId !== "string" || !b.toId) return bad("Choose the warehouse to move stock to")
        const quantity = parseQuantity(b.quantity)
        if (!quantity.ok) return bad(quantity.error)
        const reason = parseReason(b.reason)
        if (!reason.ok) return bad(reason.error)

        const result = await withAudit(guard.actor, (tx) =>
            transferStock(tx, {
                shopId: guard.shop.id,
                productId: b.productId as string,
                fromId: b.fromId as string,
                toId: b.toId as string,
                quantity: quantity.value,
                reason: reason.value,
            })
        )
        return NextResponse.json({ transfer: result }, { status: 201 })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Stock transfer error:", error)
        return bad("Something went wrong", 500)
    }
}
