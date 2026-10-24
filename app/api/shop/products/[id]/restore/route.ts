// app/api/shop/products/[id]/restore/route.ts
// POST: bring a product back from the trash.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { planRestore } from "@/lib/product-restore"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const guard = await requireShop("product.listing.restore", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const product = await prisma.product.findFirst({
            where: { id, providerId: guard.provider.id, deletedAt: { not: null } },
            select: {
                id: true,
                name: true,
                unit: true,
                catalogItemId: true,
                catalogItem: { select: { isActive: true, unit: true, categoryId: true } },
            },
        })
        if (!product) return bad("This product is not in your trash", 404)

        const plan = planRestore(product, product.catalogItem)
        if (!plan.ok) return bad(plan.error, 409)

        await withAudit(guard.actor, (tx) =>
            tx.product.update({
                where: { id },
                data: { deletedAt: null, deletedById: null, ...plan.changes },
            })
        )

        return NextResponse.json({
            product: { id: product.id, name: product.name },
            needsPriceReview: plan.changes.needsPriceReview === true,
        })
    } catch (error) {
        console.error("Restore product error:", error)
        return bad("Something went wrong", 500)
    }
}
