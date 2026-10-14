// app/api/admin/catalog/[id]/route.ts
// PATCH /api/admin/catalog/:id   edit fields and/or { isActive }
// Linked products inherit unit and category from their catalogue item, so changing
// either one here is applied to every linked product in the same transaction.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/admin-auth"
import { parseCatalogFields } from "@/lib/catalog-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAdmin())) return bad("Unauthorized", 401)
        const { id } = await params

        const current = await prisma.catalogItem.findUnique({ where: { id } })
        if (!current) return bad("Catalogue item not found", 404)

        const body = await req.json().catch(() => ({}))
        if (typeof body.isActive !== "boolean" && body.isActive !== undefined) {
            return bad("isActive must be true or false")
        }

        // Merge over the current values so a partial body (e.g. only isActive) is valid
        const fields = await parseCatalogFields({
            name: current.name,
            nameAr: current.nameAr,
            brand: current.brand,
            description: current.description,
            unit: current.unit,
            categoryId: current.categoryId,
            ...body,
        })
        if (!fields.ok) return bad(fields.error)

        const [item] = await prisma.$transaction([
            prisma.catalogItem.update({
                where: { id },
                data: {
                    ...fields.value,
                    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
                },
            }),
            prisma.product.updateMany({
                where: { catalogItemId: id },
                data: { unit: fields.value.unit, categoryId: fields.value.categoryId },
            }),
        ])

        return NextResponse.json({ item })
    } catch (error) {
        console.error("Update catalogue item error:", error)
        return bad("Something went wrong", 500)
    }
}
