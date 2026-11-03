// app/api/shop/products/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import type { ShopPermission } from "@/lib/access/catalogue"
import { priceEffect } from "@/lib/products/price-review"
import { setTotalStock, StockError } from "@/lib/inventory/stock-actions"
import { PricingError, recomputeProducts, setProductTaxes } from "@/lib/pricing/price-actions"
import { parseTaxChoice } from "@/lib/pricing/price-rules"
import {
    parseMinOrderQty,
    parsePrice,
    parseStock,
    parseText,
    parseUnit,
} from "@/lib/products/product-input"
import { isProductStatus, shopMayChange } from "@/lib/products/product-status"
import { productDto } from "@/lib/products/product-dto"
import { resolveTaxIds } from "@/lib/pricing/taxes"
import { isPublicId } from "@/lib/shared/public-id"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

async function getOwnedProduct(publicProductId: string, key: ShopPermission, req: Request) {
    const guard = await requireShop(key, req)
    if (!guard.ok) return { ok: false as const, error: guard.error, status: guard.status }

    if (!isPublicId(publicProductId)) return { ok: false as const, error: "Product not found", status: 404 as const }
    const product = await prisma.product.findFirst({
        where: { publicProductId, shopId: guard.shop.id, deletedAt: null },
        include: {
            category: { select: { id: true, name: true } },
            catalogItem: { select: { id: true, name: true, slug: true } },
        },
    })
    if (!product) return { ok: false as const, error: "Product not found", status: 404 as const }

    return { ok: true as const, product, guard }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const result = await getOwnedProduct(id, "product.listing.view", req)
        if (!result.ok) return bad(result.error, result.status)
        return NextResponse.json({ product: productDto(result.product) })
    } catch (error) {
        console.error("Get product error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const result = await getOwnedProduct(id, "product.listing.edit", req)
        if (!result.ok) return bad(result.error, result.status)
        const current = result.product
        const isLinked = current.catalogItemId !== null

        const body = await req.json()
        const data: Prisma.ProductUncheckedUpdateInput = {}
        // Stock is not a plain column: it is the total of the warehouses, changed through the ledger (lib/inventory)
        let newStock: number | undefined

        if (body.name !== undefined) {
            const r = parseText(body.name, "Name", 200)
            if (!r.ok) return bad(r.error)
            if (!r.value) return bad("Product name is required")
            data.name = r.value
        }
        if (body.nameAr !== undefined) {
            const r = parseText(body.nameAr, "Arabic name", 200)
            if (!r.ok) return bad(r.error)
            data.nameAr = r.value
        }
        if (body.description !== undefined) {
            const r = parseText(body.description, "Description", 2000)
            if (!r.ok) return bad(r.error)
            data.description = r.value
        }
        if (body.brand !== undefined) {
            const r = parseText(body.brand, "Brand", 100)
            if (!r.ok) return bad(r.error)
            data.brand = r.value
        }
        if (body.sku !== undefined) {
            const r = parseText(body.sku, "SKU", 100)
            if (!r.ok) return bad(r.error)
            data.sku = r.value
        }
        if (body.price !== undefined) {
            const r = parsePrice(body.price)
            if (!r.ok) return bad(r.error)
            data.price = r.value
        }
        if (body.stock !== undefined) {
            const r = parseStock(body.stock)
            if (!r.ok) return bad(r.error)
            newStock = r.value
        }
        if (body.minOrderQty !== undefined) {
            const r = parseMinOrderQty(body.minOrderQty)
            if (!r.ok) return bad(r.error)
            data.minOrderQty = r.value
        }
        if (body.status !== undefined) {
            if (!isProductStatus(body.status)) return bad("Unknown status")
            if (!shopMayChange(current.status, body.status)) {
                return bad(current.status === "BLOCKED" ? "The platform team removed this product from sale" : "Only the platform team can block a product", 403)
            }
            data.status = body.status
        }

        // Unit and category come from the catalogue for linked products
        if (body.unit !== undefined) {
            const r = parseUnit(body.unit)
            if (!r.ok) return bad(r.error)
            if (isLinked && r.value !== current.unit) {
                return bad("The unit is defined by the catalogue item")
            }
            data.unit = r.value
        }
        if (body.categoryId !== undefined) {
            const categoryId = body.categoryId ? String(body.categoryId) : null
            if (isLinked && categoryId !== current.categoryId) {
                return bad("The category is defined by the catalogue item")
            }
            if (categoryId) {
                const exists = await prisma.category.findUnique({
                    where: { id: categoryId },
                    select: { id: true },
                })
                if (!exists) return bad("Category not found")
            }
            data.categoryId = categoryId
        }

        // Which taxes the product carries is part of its price: same permission, and only a real change is checked
        const taxChoice = parseTaxChoice(body)
        if (!taxChoice.ok) return bad(taxChoice.error)
        const carried = new Set((await prisma.productTax.findMany({ where: { productId: current.id }, select: { taxRateId: true } })).map((t) => t.taxRateId))
        // The form sends the taxes' public ids; only this shop's own taxes are accepted
        let wanted: string[] | undefined
        if (taxChoice.value.taxIds !== undefined) {
            const resolved = await resolveTaxIds(current.shopId, taxChoice.value.taxIds)
            if (!resolved) return bad("Tax not found", 404)
            wanted = resolved
        }
        const taxesChanged =
            (wanted !== undefined && (wanted.length !== carried.size || wanted.some((t) => !carried.has(t)))) ||
            (taxChoice.value.taxExempt !== undefined && taxChoice.value.taxExempt !== current.taxExempt)
        if (taxesChanged && !result.guard.can("product.price.edit")) {
            return bad("You do not have permission to change taxes", 403)
        }

        // Price and stock have their own permissions. Only a real change is checked, so an edit form
        // that resends the unchanged values still works for someone without them.
        if (data.price !== undefined && Number(data.price) !== Number(current.price) && !result.guard.can("product.price.edit")) {
            return bad("You do not have permission to change prices", 403)
        }
        if (newStock !== undefined && newStock !== current.stock && !result.guard.can("product.stock.edit")) {
            return bad("You do not have permission to change stock", 403)
        }

        // Saving a different price, or choosing "keep this price", confirms the price: it stamps the
        // date and clears a pending price review. Sending the same price again changes nothing.
        const confirm = body.confirmPrice === true
        if (confirm && !result.guard.can("product.price.edit")) {
            return bad("You do not have permission to confirm prices", 403)
        }
        const effect = priceEffect({
            currentPrice: Number(current.price),
            nextPrice: data.price !== undefined ? Number(data.price) : undefined,
            confirm,
        })
        if (effect.stampDate) data.priceUpdatedAt = new Date()
        if (effect.clearReview && current.needsPriceReview) {
            data.needsPriceReview = false
            data.priceReviewReason = null
        }

        const product = await withAudit(result.guard.actor, async (tx) => {
            const updated = await tx.product.update({ where: { id: current.id }, data })
            let touched = false
            // The price with tax follows the price; a tax change below does the same work, so one change is one history row
            if (data.price !== undefined && Number(data.price) !== Number(current.price) && !taxesChanged) {
                await recomputeProducts(tx, current.shopId, [current.id])
                touched = true
            }
            if (taxesChanged) {
                await setProductTaxes(tx, { shopId: current.shopId, productId: current.id, taxIds: wanted, exempt: taxChoice.value.taxExempt })
                touched = true
            }
            if (newStock !== undefined && newStock !== current.stock) {
                await setTotalStock(tx, { shopId: current.shopId, productId: current.id, target: newStock })
                touched = true
            }
            return touched ? tx.product.findUniqueOrThrow({ where: { id: current.id } }) : updated
        })
        return NextResponse.json({ product: productDto(product) })
    } catch (error) {
        if (error instanceof StockError) return bad(error.message, error.status)
        if (error instanceof PricingError) return bad(error.message, error.status)
        console.error("Update product error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const result = await getOwnedProduct(id, "product.listing.delete", req)
        if (!result.ok) return bad(result.error, result.status)

        // Soft delete: the row stays (orders will point at it) but disappears from every list.
        // It sits in the shop's Trash until someone with product.listing.restore brings it back.
        await withAudit(result.guard.actor, (tx) =>
            tx.product.update({
                where: { id: result.product.id },
                data: { deletedAt: new Date(), deletedById: result.guard.userId },
            })
        )
        return NextResponse.json({
            message: "Product moved to trash",
            // Lets the screen offer "Undo" only to people who may restore
            canRestore: result.guard.can("product.listing.restore"),
        })
    } catch (error) {
        console.error("Delete product error:", error)
        return bad("Something went wrong", 500)
    }
}
