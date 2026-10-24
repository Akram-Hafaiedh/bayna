// app/api/shop/products/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Unit } from "@/app/generated/prisma/enums"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { listProducts } from "@/lib/provider-products"
import { parseProductFilters } from "@/lib/product-filters"
import {
    parseMinOrderQty,
    parsePrice,
    parseStock,
    parseText,
    parseUnit,
} from "@/lib/product-input"

const bad = (error: string, status = 400, extra?: Record<string, unknown>) =>
    NextResponse.json({ error, ...extra }, { status })

// GET /api/shop/products?q=&category=&status=&stock=&linked=&unit=&sort=&dir=&page=&pageSize=
export async function GET(req: Request) {
    try {
        const guard = await requireShop("product.listing.view", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const filters = parseProductFilters(new URL(req.url).searchParams)
        const result = await listProducts(guard.provider.id, filters)

        return NextResponse.json({
            products: result.items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            pageCount: result.pageCount,
        })
    } catch (error) {
        console.error("List products error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function POST(req: Request) {
    try {
        const guard = await requireShop("product.listing.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const providerId = guard.provider.id

        const body = await req.json()

        // Setting a price or opening stock needs its own permission (an inventory clerk may not).
        if (Number(body.price) > 0 && !guard.can("product.price.edit")) {
            return bad("You do not have permission to set prices", 403)
        }
        if (Number(body.stock) > 0 && !guard.can("product.stock.edit")) {
            return bad("You do not have permission to set stock", 403)
        }

        // Optional link to the shared catalogue. A linked product inherits the
        // catalogue unit and category so prices stay comparable across providers.
        let catalog: { id: string; name: string; brand: string | null; unit: Unit; categoryId: string } | null = null
        if (body.catalogItemId) {
            catalog = await prisma.catalogItem.findFirst({
                where: { id: String(body.catalogItemId), isActive: true },
                select: { id: true, name: true, brand: true, unit: true, categoryId: true },
            })
            if (!catalog) return bad("Catalogue item not found")

            const existing = await prisma.product.findFirst({
                where: { providerId, catalogItemId: catalog.id },
                select: { id: true, deletedAt: true },
            })
            if (existing && !existing.deletedAt) {
                return bad("You already list this catalogue item", 409, { productId: existing.id })
            }
            // A shop lists a catalogue item at most once, so a removed listing blocks a new one.
            // It is restored from the Trash, never silently brought back by adding it again.
            if (existing) {
                return bad("You removed this item earlier. Restore it from your Trash instead of adding it again.", 409, {
                    inTrash: true,
                    productId: existing.id,
                })
            }
        }

        const name = parseText(body.name, "Name", 200)
        const nameAr = parseText(body.nameAr, "Arabic name", 200)
        const description = parseText(body.description, "Description", 2000)
        const brand = parseText(body.brand, "Brand", 100)
        const sku = parseText(body.sku, "SKU", 100)
        const price = parsePrice(body.price)
        const stock = parseStock(body.stock)
        const minOrderQty = parseMinOrderQty(body.minOrderQty)
        for (const r of [name, nameAr, description, brand, sku, price, stock, minOrderQty]) {
            if (!r.ok) return bad(r.error)
        }

        const finalName = (name.ok && name.value) || catalog?.name
        if (!finalName) return bad("Product name is required")

        let unit: Unit
        let categoryId: string | null
        if (catalog) {
            unit = catalog.unit
            categoryId = catalog.categoryId
        } else {
            const u = body.unit === undefined || body.unit === "" ? null : parseUnit(body.unit)
            if (u && !u.ok) return bad(u.error)
            unit = u && u.ok ? u.value : Unit.PIECE

            categoryId = body.categoryId ? String(body.categoryId) : null
            if (categoryId) {
                const exists = await prisma.category.findUnique({
                    where: { id: categoryId },
                    select: { id: true },
                })
                if (!exists) return bad("Category not found")
            }
        }

        // Optional: ask for the item to be added to the shared catalogue (custom products only)
        const wantsSuggestion = !catalog && body.suggestToCatalogue === true
        if (wantsSuggestion) {
            if (!categoryId) return bad("Choose a category to suggest this item for the catalogue")

            const match = await prisma.catalogItem.findFirst({
                where: { isActive: true, name: { equals: finalName, mode: "insensitive" } },
                select: { id: true, name: true },
            })
            if (match) {
                return bad("This item is already in the catalogue. Search for it and select it.", 409, {
                    catalogItemId: match.id,
                    catalogItemName: match.name,
                })
            }

            const pending = await prisma.catalogSuggestion.findFirst({
                where: {
                    providerId,
                    status: "PENDING",
                    name: { equals: finalName, mode: "insensitive" },
                },
                select: { id: true },
            })
            if (pending) return bad("You already suggested this item. It is waiting for review.", 409)
        }
        const note = parseText(body.suggestionNote, "Note", 500)
        if (!note.ok) return bad(note.error)

        const product = await withAudit(guard.actor, (tx) =>
            tx.product.create({
                data: {
                    providerId,
                    catalogItemId: catalog?.id ?? null,
                    name: finalName,
                    nameAr: nameAr.ok ? nameAr.value : null,
                    description: description.ok ? description.value : null,
                    brand: (brand.ok && brand.value) || catalog?.brand || null,
                    sku: sku.ok ? sku.value : null,
                    unit,
                    price: price.ok ? price.value : "0.000",
                    stock: stock.ok ? stock.value : 0,
                    minOrderQty: minOrderQty.ok ? minOrderQty.value : null,
                    categoryId,
                    isActive: body.isActive !== false,
                    priceUpdatedAt: new Date(),
                    images: [],
                    ...(wantsSuggestion && categoryId
                        ? {
                            suggestion: {
                                create: {
                                    providerId,
                                    name: finalName,
                                    nameAr: nameAr.ok ? nameAr.value : null,
                                    brand: brand.ok ? brand.value : null,
                                    unit,
                                    categoryId,
                                    note: note.value,
                                },
                            },
                        }
                        : {}),
                },
            })
        )

        return NextResponse.json({ product }, { status: 201 })
    } catch (error) {
        // Unique (providerId, catalogItemId) hit by a concurrent request
        if ((error as { code?: string })?.code === "P2002") {
            return bad("You already list this catalogue item", 409)
        }
        console.error("Create product error:", error)
        return bad("Something went wrong", 500)
    }
}
