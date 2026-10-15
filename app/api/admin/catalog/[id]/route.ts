// app/api/admin/catalog/[id]/route.ts
// PATCH /api/admin/catalog/:id   edit fields and/or { isActive }
// Linked products inherit unit and category from their catalogue item, so changing
// either one here is applied to every linked product in the same transaction.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { parseCatalogFields } from "@/lib/catalog-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("catalog.item.update", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const { id } = await params

        const current = await prisma.catalogItem.findUnique({ where: { id } })
        if (!current) return bad("Catalogue item not found", 404)

        const body = await req.json().catch(() => ({}))
        if (typeof body.isActive !== "boolean" && body.isActive !== undefined) {
            return bad("isActive must be true or false")
        }
        // Hiding or restoring an item is its own permission
        if (typeof body.isActive === "boolean" && body.isActive !== current.isActive && !guard.can("catalog.item.archive")) {
            return bad("Forbidden", 403)
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

        const item = await withAudit(guard.actor, async (tx) => {
            const updated = await tx.catalogItem.update({
                where: { id },
                data: {
                    ...fields.value,
                    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
                },
            })
            await tx.product.updateMany({
                where: { catalogItemId: id },
                data: { unit: fields.value.unit, categoryId: fields.value.categoryId },
            })
            return updated
        })

        return NextResponse.json({ item })
    } catch (error) {
        console.error("Update catalogue item error:", error)
        return bad("Something went wrong", 500)
    }
}
