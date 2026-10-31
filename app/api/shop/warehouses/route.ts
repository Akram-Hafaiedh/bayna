// app/api/shop/warehouses/route.ts
// GET   the shop's warehouses with their totals (?archived=1 to include archived ones)
// POST  add a warehouse (inventory.location.manage; counts toward the plan's warehouse limit)
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { limitBlock } from "@/lib/plans/plan-limits"
import { createWarehouse, ensureDefaultWarehouse, StockError } from "@/lib/inventory/stock-actions"
import { parseWarehouseFields } from "@/lib/inventory/warehouse-input"
import { listWarehouses } from "@/lib/inventory/warehouses"

const bad = (error: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status })

export async function GET(req: Request) {
    try {
        const guard = await requireShop("product.listing.view", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const includeArchived = new URL(req.url).searchParams.get("archived") === "1"

        let warehouses = await listWarehouses(guard.shop.id, { includeArchived })
        // A shop that never touched stock has none yet: make its default one (not during a read-only view)
        if (warehouses.length === 0 && !guard.actor.readOnly) {
            await withAudit(guard.actor, (tx) => ensureDefaultWarehouse(tx, guard.shop.id))
            warehouses = await listWarehouses(guard.shop.id, { includeArchived })
        }
        return NextResponse.json({ warehouses })
    } catch (error) {
        console.error("List warehouses error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function POST(req: Request) {
    try {
        const guard = await requireShop("inventory.location.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const blocked = guard.shop.businessId ? await limitBlock(guard.shop.businessId, "warehouses") : null
        if (blocked) return bad(blocked, 403, { code: "plan_limit" })

        const parsed = parseWarehouseFields(await req.json().catch(() => null), null)
        if (!parsed.ok) return bad(parsed.error)
        const d = parsed.value

        const warehouse = await withAudit(guard.actor, (tx) =>
            createWarehouse(tx, guard.shop.id, { ...d, name: d.name!, city: d.city! })
        )
        return NextResponse.json({ warehouse }, { status: 201 })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Create warehouse error:", error)
        return bad("Something went wrong", 500)
    }
}
