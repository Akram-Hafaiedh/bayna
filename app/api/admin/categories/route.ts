// app/api/admin/categories/route.ts
// GET  /api/admin/categories   flat list (parentId links the tree) with usage counts
// POST /api/admin/categories   create a category
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { slugify } from "@/lib/shared/slug"
import { parseCategoryFields } from "@/lib/catalogue/category-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function GET(req: Request) {
    try {
        const guard = await requirePlatform("catalog.category.view", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const rows = await prisma.category.findMany({
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
                id: true,
                name: true,
                nameAr: true,
                slug: true,
                description: true,
                parentId: true,
                sortOrder: true,
                _count: { select: { catalogItems: true, products: true } },
            },
        })

        return NextResponse.json({
            categories: rows.map(({ _count, ...c }) => ({
                ...c,
                itemCount: _count.catalogItems,
                productCount: _count.products,
            })),
        })
    } catch (error) {
        console.error("List categories error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function POST(req: Request) {
    try {
        const guard = await requirePlatform("catalog.category.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const body = await req.json().catch(() => ({}))
        const fields = await parseCategoryFields(body)
        if (!fields.ok) return bad(fields.error)

        const base = slugify(fields.value.name) || "category"
        let slug = base
        for (let n = 2; await prisma.category.findUnique({ where: { slug }, select: { id: true } }); n++) {
            slug = `${base}-${n}`
        }

        // Add to the end of its siblings
        const last = await prisma.category.aggregate({
            where: { parentId: fields.value.parentId },
            _max: { sortOrder: true },
        })

        const category = await withAudit(guard.actor, (tx) =>
            tx.category.create({
                data: { ...fields.value, slug, sortOrder: (last._max.sortOrder ?? 0) + 1 },
            })
        )
        return NextResponse.json({ category }, { status: 201 })
    } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
            return bad("A category with this name already exists", 409)
        }
        console.error("Create category error:", error)
        return bad("Something went wrong", 500)
    }
}
