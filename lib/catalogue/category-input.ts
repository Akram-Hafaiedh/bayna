// lib/catalogue/category-input.ts
// Validation shared by the admin category routes. Categories form a two-level tree.
import { prisma } from "@/lib/prisma"
import { parseText, type Parsed } from "@/lib/products/product-input"

export type CategoryFields = {
    name: string
    nameAr: string | null
    description: string | null
    parentId: string | null
}

/**
 * `selfId` is set when editing: a category cannot be its own parent, and a category that
 * already has children cannot become a child (the tree has two levels).
 */
export async function parseCategoryFields(
    body: Record<string, unknown>,
    selfId?: string
): Promise<Parsed<CategoryFields>> {
    const name = parseText(body.name, "Name", 120)
    const nameAr = parseText(body.nameAr, "Arabic name", 120)
    const description = parseText(body.description, "Description", 500)
    for (const r of [name, nameAr, description]) {
        if (!r.ok) return { ok: false, error: r.error }
    }
    if (!name.ok || !name.value) return { ok: false, error: "Name is required" }

    let parentId: string | null = null
    if (body.parentId !== undefined && body.parentId !== null && body.parentId !== "") {
        if (typeof body.parentId !== "string") return { ok: false, error: "Invalid parent category" }
        if (body.parentId === selfId) return { ok: false, error: "A category cannot be its own parent" }

        const parent = await prisma.category.findUnique({
            where: { id: body.parentId },
            select: { id: true, parentId: true },
        })
        if (!parent) return { ok: false, error: "Parent category not found" }
        if (parent.parentId) return { ok: false, error: "Categories can only be nested one level deep" }

        if (selfId) {
            const children = await prisma.category.count({ where: { parentId: selfId } })
            if (children > 0) {
                return { ok: false, error: "This category has sub-categories, so it cannot be moved under another one" }
            }
        }
        parentId = parent.id
    }

    return {
        ok: true,
        value: {
            name: name.value,
            nameAr: nameAr.ok ? nameAr.value : null,
            description: description.ok ? description.value : null,
            parentId,
        },
    }
}
