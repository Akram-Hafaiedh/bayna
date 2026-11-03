// app/api/shop/taxes/reorder/route.ts
// PATCH { ids: [...] }: the order the shop's taxes apply in (every tax once). Needs pricing.tax.manage.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { PricingError, reorderTaxes } from "@/lib/pricing/price-actions"
import { prisma } from "@/lib/prisma"
import { isPublicId } from "@/lib/shared/public-id"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: Request) {
    try {
        const guard = await requireShop("pricing.tax.manage", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const b = (await req.json().catch(() => null)) as { ids?: unknown } | null
        if (!b || !Array.isArray(b.ids) || b.ids.some((x) => typeof x !== "string")) return bad("Send the list of tax ids in the order you want")
        // The list names taxes by public id; map it to the shop's own taxes, keeping the order sent
        const asked = b.ids as string[]
        const rows = await prisma.taxRate.findMany({ where: { shopId: guard.shop.id }, select: { id: true, publicTaxId: true } })
        const byPublic = new Map(rows.map((r) => [r.publicTaxId, r.id]))
        if (asked.some((x) => !isPublicId(x) || !byPublic.has(x))) return bad("Send every tax of the shop once, in the order you want")
        await withAudit(guard.actor, (tx) => reorderTaxes(tx, guard.shop.id, asked.map((x) => byPublic.get(x) as string)))
        return NextResponse.json({ message: "Order saved" })
    } catch (error) {
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Reorder taxes error:", error)
        return bad("Something went wrong", 500)
    }
}
