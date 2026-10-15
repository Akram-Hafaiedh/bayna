// app/api/provider/products/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import type { ShopPermission } from "@/lib/access/catalogue"
import {
    parseMinOrderQty,
    parsePrice,
    parseStock,
    parseText,
    parseUnit,
} from "@/lib/product-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

async function getOwnedProduct(productId: string, key: ShopPermission, req: Request) {
    const guard = await requireShop(key, req)
    if (!guard.ok) return { ok: false as const, error: guard.error, status: guard.status }

    const product = await prisma.product.findFirst({
        where: { id: productId, providerId: guard.provider.id },
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
        return NextResponse.json({ product: result.product })
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
            data.stock = r.value
        }
        if (body.minOrderQty !== undefined) {
            const r = parseMinOrderQty(body.minOrderQty)
            if (!r.ok) return bad(r.error)
            data.minOrderQty = r.value
        }
        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

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

        // Price and stock have their own permissions. Only a real change is checked, so an edit form
        // that resends the unchanged values still works for someone without them.
        if (data.price !== undefined && Number(data.price) !== Number(current.price) && !result.guard.can("product.price.edit")) {
            return bad("You do not have permission to change prices", 403)
        }
        if (data.stock !== undefined && data.stock !== current.stock && !result.guard.can("product.stock.edit")) {
            return bad("You do not have permission to change stock", 403)
        }

        const product = await withAudit(result.guard.actor, (tx) => tx.product.update({ where: { id }, data }))
        return NextResponse.json({ product })
    } catch (error) {
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

        await withAudit(result.guard.actor, (tx) => tx.product.delete({ where: { id } }))
        return NextResponse.json({ message: "Product deleted" })
    } catch (error) {
        console.error("Delete product error:", error)
        return bad("Something went wrong", 500)
    }
}
