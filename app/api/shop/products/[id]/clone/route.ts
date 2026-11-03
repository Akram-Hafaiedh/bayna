// app/api/shop/products/[id]/clone/route.ts
// POST make a draft copy of a product: the same name (with "(copy)"), price, unit, category, brand,
// description, minimum order, images and taxes. Not copied: the SKU (a reference belongs to one product), the
// stock and its history (the copy starts empty), and the catalogue link (a shop lists a catalogue item once, so
// the copy is a custom product). Needs product.listing.create, and product.price.edit when it has a price,
// like creating a product does.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { limitBlock } from "@/lib/plans/plan-limits"
import { PricingError, setProductTaxes } from "@/lib/pricing/price-actions"
import { recordPriceHistory } from "@/lib/pricing/price-history"
import { productDto } from "@/lib/products/product-dto"
import { isPublicId } from "@/lib/shared/public-id"
import { cloneName } from "@/lib/products/product-clone"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const guard = await requireShop("product.listing.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const shopId = guard.shop.id

        if (guard.shop.businessId) {
            const blocked = await limitBlock(guard.shop.businessId, "products")
            if (blocked) return bad(blocked, 403)
        }

        if (!isPublicId(id)) return bad("Product not found", 404)
        const source = await prisma.product.findFirst({
            where: { publicProductId: id, shopId, deletedAt: null },
            include: { taxes: { select: { taxRateId: true } } },
        })
        if (!source) return bad("Product not found", 404)
        if (Number(source.price) > 0 && !guard.can("product.price.edit")) {
            return bad("You do not have permission to set prices", 403)
        }

        const product = await withAudit(guard.actor, async (tx) => {
            const created = await tx.product.create({
                data: {
                    shopId,
                    catalogItemId: null,
                    name: cloneName(source.name),
                    nameAr: source.nameAr,
                    description: source.description,
                    brand: source.brand,
                    sku: null,
                    unit: source.unit,
                    price: source.price,
                    priceTtc: source.price, // worked out below when the product carries taxes
                    stock: 0,
                    minOrderQty: source.minOrderQty,
                    categoryId: source.categoryId,
                    status: "DRAFT",
                    priceUpdatedAt: new Date(),
                    images: source.images,
                },
            })
            const taxIds = source.taxes.map((t) => t.taxRateId)
            if (source.taxExempt) {
                await setProductTaxes(tx, { shopId, productId: created.id, exempt: true })
            } else if (taxIds.length > 0) {
                await setProductTaxes(tx, { shopId, productId: created.id, taxIds })
            }
            await recordPriceHistory(tx, shopId, [created.id]) // the first price (a no-op when the taxes above already did)
            return tx.product.findUniqueOrThrow({ where: { id: created.id } })
        })
        return NextResponse.json({ product: productDto(product) }, { status: 201 })
    } catch (error) {
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Clone product error:", error)
        return bad("Something went wrong", 500)
    }
}
