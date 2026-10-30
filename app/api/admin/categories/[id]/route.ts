// app/api/admin/categories/[id]/route.ts
// PATCH /api/admin/categories/:id   rename, edit description, or move under another category.
// The slug stays the same so links and the seed keep working.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { parseCategoryFields } from "@/lib/catalogue/category-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("catalog.category.update", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const { id } = await params

        const current = await prisma.category.findUnique({ where: { id } })
        if (!current) return bad("Category not found", 404)

        const body = await req.json().catch(() => ({}))
        const fields = await parseCategoryFields(
            {
                name: current.name,
                nameAr: current.nameAr,
                description: current.description,
                parentId: current.parentId,
                ...body,
            },
            id
        )
        if (!fields.ok) return bad(fields.error)

        // Moving to a different parent puts it last among its new siblings
        let sortOrder = current.sortOrder
        if (fields.value.parentId !== current.parentId) {
            const last = await prisma.category.aggregate({
                where: { parentId: fields.value.parentId },
                _max: { sortOrder: true },
            })
            sortOrder = (last._max.sortOrder ?? 0) + 1
        }

        const category = await withAudit(guard.actor, (tx) =>
            tx.category.update({
                where: { id },
                data: { ...fields.value, sortOrder },
            })
        )
        return NextResponse.json({ category })
    } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
            return bad("A category with this name already exists", 409)
        }
        console.error("Update category error:", error)
        return bad("Something went wrong", 500)
    }
}
