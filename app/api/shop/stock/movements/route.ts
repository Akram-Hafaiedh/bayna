// app/api/shop/stock/movements/route.ts
// GET ?warehouse=&product=&type=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize=
// The stock history, newest first (inventory.movement.view).
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { parseMovementQuery } from "@/lib/inventory/movement-query"
import { listMovements } from "@/lib/inventory/warehouses"

export async function GET(req: Request) {
    try {
        const guard = await requireShop("inventory.movement.view", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
        const result = await listMovements(guard.shop.id, parseMovementQuery(new URL(req.url).searchParams))
        return NextResponse.json(result)
    } catch (error) {
        console.error("List stock movements error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
