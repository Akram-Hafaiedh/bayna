// app/api/shop/stock/route.ts
// POST { productId, warehouseId, type, quantity, reasonCode, reason? }: a manual stock movement (inventory.adjustment.create)
//   type RECEIVED   stock came in; quantity >= 1
//   type RETURNED   units came back (a customer return); quantity >= 1
//   type ADJUSTED   a correction; quantity is plus or minus, not 0
//   type COUNTED    a stocktake; quantity is what was counted (0 or more), the difference is recorded
// reasonCode is required and must fit the type (and, for ADJUSTED, the sign); `reason` is the free-text note,
// required when the code is OTHER. See lib/inventory/stock-reasons.ts. Transfers have their own route; SOLD belongs to orders.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { manualMovement, StockError } from "@/lib/inventory/stock-actions"
import { isManualType, type ManualType, parseCount, parseDelta, parseQuantity, parseReason } from "@/lib/inventory/stock-rules"
import { parseReasonChoice } from "@/lib/inventory/stock-reasons"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
    try {
        const guard = await requireShop("inventory.adjustment.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
        if (!b || typeof b !== "object" || Array.isArray(b)) return bad("Invalid request")
        if (typeof b.productId !== "string" || !b.productId) return bad("Choose a product")
        if (typeof b.warehouseId !== "string" || !b.warehouseId) return bad("Choose a warehouse")
        if (!isManualType(b.type)) return bad("The type must be RECEIVED, RETURNED, ADJUSTED or COUNTED")

        const amount = b.type === "RECEIVED" || b.type === "RETURNED" ? parseQuantity(b.quantity) : b.type === "ADJUSTED" ? parseDelta(b.quantity) : parseCount(b.quantity)
        if (!amount.ok) return bad(amount.error)
        const note = parseReason(b.reason)
        if (!note.ok) return bad(note.error)
        const why = parseReasonChoice(b.type, amount.value, b.reasonCode, note.value)
        if (!why.ok) return bad(why.error)

        const result = await withAudit(guard.actor, (tx) =>
            manualMovement(tx, b.type as ManualType, {
                shopId: guard.shop.id,
                productId: b.productId as string,
                warehouseId: b.warehouseId as string,
                amount: amount.value,
                reasonCode: why.value.reasonCode,
                reason: why.value.reason,
            })
        )
        return NextResponse.json({ movement: result }, { status: 201 })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Stock movement error:", error)
        return bad("Something went wrong", 500)
    }
}
