// app/api/shop/taxes/[id]/route.ts
// PATCH   edit a tax (name, kind, value, appliesOn, isActive); the products that carry it are priced again
// DELETE  remove a tax; the products that carried it are priced again without it
// Both need pricing.tax.manage.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { deleteTax, PricingError, updateTax } from "@/lib/pricing/price-actions"
import { parseTaxFields } from "@/lib/pricing/price-rules"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const guard = await requireShop("pricing.tax.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const current = await prisma.taxRate.findFirst({ where: { id, shopId: guard.shop.id } })
        if (!current) return bad("Tax not found", 404)

        const parsed = parseTaxFields(await req.json().catch(() => null), { kind: current.kind, value: current.value.toString() })
        if (!parsed.ok) return bad(parsed.error)
        const tax = await withAudit(guard.actor, (tx) => updateTax(tx, guard.shop.id, id, parsed.value))
        return NextResponse.json({ tax: { ...tax, value: tax.value.toString() } })
    } catch (error) {
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Update tax error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const guard = await requireShop("pricing.tax.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const result = await withAudit(guard.actor, (tx) => deleteTax(tx, guard.shop.id, id))
        return NextResponse.json({ message: "Tax deleted", ...result })
    } catch (error) {
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Delete tax error:", error)
        return bad("Something went wrong", 500)
    }
}
