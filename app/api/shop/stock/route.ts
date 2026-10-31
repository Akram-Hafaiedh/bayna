// app/api/shop/stock/route.ts
// POST { productId, warehouseId, type, quantity, reason? }: a manual stock movement (inventory.adjustment.create)
//   type RECEIVED   stock came in; quantity >= 1
//   type ADJUSTED   a correction; quantity is plus or minus, not 0
//   type COUNTED    a stocktake; quantity is what was counted (0 or more), the difference is recorded
// Transfers have their own route; SOLD and RETURNED belong to orders.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { manualMovement, StockError } from "@/lib/inventory/stock-actions"
import { isManualType, parseCount, parseDelta, parseQuantity, parseReason } from "@/lib/inventory/stock-rules"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
    try {
        const guard = await requireShop("inventory.adjustment.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
        if (!b || typeof b !== "object" || Array.isArray(b)) return bad("Invalid request")
        if (typeof b.productId !== "string" || !b.productId) return bad("Choose a product")
        if (typeof b.warehouseId !== "string" || !b.warehouseId) return bad("Choose a warehouse")
        if (!isManualType(b.type)) return bad("The type must be RECEIVED, ADJUSTED or COUNTED")

        const amount = b.type === "RECEIVED" ? parseQuantity(b.quantity) : b.type === "ADJUSTED" ? parseDelta(b.quantity) : parseCount(b.quantity)
        if (!amount.ok) return bad(amount.error)
        const reason = parseReason(b.reason)
        if (!reason.ok) return bad(reason.error)

        const result = await withAudit(guard.actor, (tx) =>
            manualMovement(tx, b.type as "RECEIVED" | "ADJUSTED" | "COUNTED", {
                shopId: guard.shop.id,
                productId: b.productId as string,
                warehouseId: b.warehouseId as string,
                amount: amount.value,
                reason: reason.value,
            })
        )
        return NextResponse.json({ movement: result }, { status: 201 })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Stock movement error:", error)
        return bad("Something went wrong", 500)
    }
}
