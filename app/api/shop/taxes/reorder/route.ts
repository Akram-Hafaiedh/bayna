// app/api/shop/taxes/reorder/route.ts
// PATCH { ids: [...] }: the order the shop's taxes apply in (every tax once). Needs pricing.tax.manage.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { PricingError, reorderTaxes } from "@/lib/pricing/price-actions"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: Request) {
    try {
        const guard = await requireShop("pricing.tax.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const b = (await req.json().catch(() => null)) as { ids?: unknown } | null
        if (!b || !Array.isArray(b.ids) || b.ids.some((x) => typeof x !== "string")) return bad("Send the list of tax ids in the order you want")
        await withAudit(guard.actor, (tx) => reorderTaxes(tx, guard.shop.id, b.ids as string[]))
        return NextResponse.json({ message: "Order saved" })
    } catch (error) {
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Reorder taxes error:", error)
        return bad("Something went wrong", 500)
    }
}
