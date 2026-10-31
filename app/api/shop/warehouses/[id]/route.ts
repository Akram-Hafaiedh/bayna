// app/api/shop/warehouses/[id]/route.ts
// PATCH   edit fields, and/or { makeDefault: true }, { archived: true | false }
// DELETE  only a warehouse that never had a movement (otherwise archive it)
// All need inventory.location.manage.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { limitBlock } from "@/lib/plans/plan-limits"
import {
    archiveWarehouse, deleteWarehouse, makeDefaultWarehouse, restoreWarehouse, StockError,
} from "@/lib/inventory/stock-actions"
import { parseWarehouseFields } from "@/lib/inventory/warehouse-input"

const bad = (error: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const guard = await requireShop("inventory.location.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const current = await prisma.warehouse.findFirst({ where: { id, shopId: guard.shop.id } })
        if (!current) return bad("Warehouse not found", 404)

        const body = await req.json().catch(() => null)
        if (typeof body !== "object" || body === null || Array.isArray(body)) return bad("Invalid request")
        const b = body as Record<string, unknown>

        const fields = parseWarehouseFields(b, current)
        if (!fields.ok) return bad(fields.error)
        if (b.archived !== undefined && typeof b.archived !== "boolean") return bad("archived must be true or false")
        if (b.makeDefault !== undefined && b.makeDefault !== true) return bad("makeDefault can only be true")

        // Bringing an archived warehouse back uses a place of the plan again
        if (b.archived === false && current.archivedAt) {
            const blocked = guard.shop.businessId ? await limitBlock(guard.shop.businessId, "warehouses") : null
            if (blocked) return bad(blocked, 403, { code: "plan_limit" })
        }

        const warehouse = await withAudit(guard.actor, async (tx) => {
            if (Object.keys(fields.value).length > 0) await tx.warehouse.update({ where: { id }, data: fields.value })
            if (b.archived === true) await archiveWarehouse(tx, guard.shop.id, id)
            if (b.archived === false) await restoreWarehouse(tx, guard.shop.id, id)
            if (b.makeDefault === true) await makeDefaultWarehouse(tx, guard.shop.id, id)
            return tx.warehouse.findUniqueOrThrow({ where: { id } })
        })
        return NextResponse.json({ warehouse })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Update warehouse error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const guard = await requireShop("inventory.location.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        await withAudit(guard.actor, (tx) => deleteWarehouse(tx, guard.shop.id, id))
        return NextResponse.json({ message: "Warehouse deleted" })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        console.error("Delete warehouse error:", error)
        return bad("Something went wrong", 500)
    }
}
