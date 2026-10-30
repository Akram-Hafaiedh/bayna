// lib/catalog-input.ts
// Validation of catalogue item fields coming from admin API request bodies.
import { prisma } from "@/lib/prisma"
import type { Unit } from "@/app/generated/prisma/enums"
import { parseText, parseUnit, type Parsed } from "@/lib/products/product-input"

export type CatalogFields = {
    name: string
    nameAr: string | null
    brand: string | null
    description: string | null
    unit: Unit
    categoryId: string
}

/** Full set of fields for a new catalogue item. Name, unit and category are required. */
export async function parseCatalogFields(body: Record<string, unknown>): Promise<Parsed<CatalogFields>> {
    const name = parseText(body.name, "Name", 200)
    const nameAr = parseText(body.nameAr, "Arabic name", 200)
    const brand = parseText(body.brand, "Brand", 100)
    const description = parseText(body.description, "Description", 2000)
    for (const r of [name, nameAr, brand, description]) {
        if (!r.ok) return { ok: false, error: r.error }
    }
    if (!name.ok || !name.value) return { ok: false, error: "Name is required" }

    const unit = parseUnit(body.unit)
    if (!unit.ok) return { ok: false, error: unit.error }

    const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
    if (!categoryId) return { ok: false, error: "Choose a category" }
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
    if (!category) return { ok: false, error: "Category not found" }

    return {
        ok: true,
        value: {
            name: name.value,
            nameAr: nameAr.ok ? nameAr.value : null,
            brand: brand.ok ? brand.value : null,
            description: description.ok ? description.value : null,
            unit: unit.value,
            categoryId,
        },
    }
}

/** Returns a slug that is not used by another catalogue item. */
export async function uniqueCatalogSlug(base: string): Promise<string> {
    let slug = base || "item"
    for (let n = 2; await prisma.catalogItem.findUnique({ where: { slug }, select: { id: true } }); n++) {
        slug = `${base || "item"}-${n}`
    }
    return slug
}
