// app/api/admin/catalog/route.ts
// GET  /api/admin/catalog?q=&category=&status=active|inactive|all&page=&pageSize=
// POST /api/admin/catalog   create a catalogue item directly
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { slugify } from "@/lib/slug"
import { parseCatalogFields, uniqueCatalogSlug } from "@/lib/catalog-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function GET(req: Request) {
    try {
        const guard = await requirePlatform("catalog.item.view", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const params = new URL(req.url).searchParams
        const q = (params.get("q") ?? "").trim().slice(0, 100)
        const category = params.get("category")
        const status = params.get("status") ?? "active"
        const pageSize = Math.min(Math.max(Number.parseInt(params.get("pageSize") ?? "25", 10) || 25, 1), 100)
        const page = Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1)

        const and: Prisma.CatalogItemWhereInput[] = q
            .split(/\s+/)
            .filter(Boolean)
            .map((term) => ({
                OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { nameAr: { contains: term, mode: "insensitive" } },
                    { brand: { contains: term, mode: "insensitive" } },
                ],
            }))

        if (category) {
            const children = await prisma.category.findMany({
                where: { parentId: category },
                select: { id: true },
            })
            and.push({ categoryId: { in: [category, ...children.map((c) => c.id)] } })
        }
        if (status === "active") and.push({ isActive: true })
        if (status === "inactive") and.push({ isActive: false })

        const where: Prisma.CatalogItemWhereInput = { AND: and }
        const [total, items] = await Promise.all([
            prisma.catalogItem.count({ where }),
            prisma.catalogItem.findMany({
                where,
                orderBy: [{ name: "asc" }, { id: "asc" }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    nameAr: true,
                    brand: true,
                    description: true,
                    unit: true,
                    isActive: true,
                    category: { select: { id: true, name: true } },
                    _count: { select: { products: true } },
                },
            }),
        ])

        return NextResponse.json({
            items: items.map(({ _count, ...i }) => ({ ...i, productCount: _count.products })),
            total,
            page,
            pageSize,
            pageCount: Math.max(Math.ceil(total / pageSize), 1),
        })
    } catch (error) {
        console.error("List catalogue error:", error)
        return bad("Something went wrong", 500)
    }
}

export async function POST(req: Request) {
    try {
        const guard = await requirePlatform("catalog.item.create", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const body = await req.json().catch(() => ({}))
        const fields = await parseCatalogFields(body)
        if (!fields.ok) return bad(fields.error)

        const category = await prisma.category.findUnique({
            where: { id: fields.value.categoryId },
            select: { slug: true },
        })
        const slug = await uniqueCatalogSlug(slugify(`${category?.slug ?? ""}-${fields.value.name}`))
        const item = await withAudit(guard.actor, (tx) => tx.catalogItem.create({ data: { ...fields.value, slug } }))

        return NextResponse.json({ item }, { status: 201 })
    } catch (error) {
        console.error("Create catalogue item error:", error)
        return bad("Something went wrong", 500)
    }
}
