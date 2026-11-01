// app/api/shop/taxes/route.ts
// GET   the shop's taxes in the order they apply, with how many products carry each
// POST  add a tax (pricing.tax.manage; counts toward the plan's custom-tax limit)
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { limitBlock } from "@/lib/plans/plan-limits"
import { createTax, PricingError } from "@/lib/pricing/price-actions"
import { parseTaxFields } from "@/lib/pricing/price-rules"
import { listTaxes } from "@/lib/pricing/taxes"

const bad = (error: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status })

export async function GET(req: Request) {
    try {
        const guard = await requireShop("product.listing.view", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        return NextResponse.json({ taxes: await listTaxes(guard.shop.id) })
    } catch (error) {
        console.error("List taxes error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function POST(req: Request) {
    try {
        const guard = await requireShop("pricing.tax.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const blocked = guard.shop.businessId ? await limitBlock(guard.shop.businessId, "customTaxes") : null
        if (blocked) return bad(blocked, 403, { code: "plan_limit" })

        const parsed = parseTaxFields(await req.json().catch(() => null), null)
        if (!parsed.ok) return bad(parsed.error)
        const d = parsed.value
        const tax = await withAudit(guard.actor, (tx) => createTax(tx, guard.shop.id, { ...d, name: d.name!, kind: d.kind!, value: d.value! }))
        return NextResponse.json({ tax: { ...tax, value: tax.value.toString() } }, { status: 201 })
    } catch (error) {
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Create tax error:", error)
        return bad("Something went wrong", 500)
    }
}
