// app/api/catalog/route.ts
// Catalogue search for the "add product" flow: find a shared item to link a product to.
// GET /api/catalog?q=&category=&limit=
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { requireShop } from "@/lib/access/guard"

export async function GET(req: Request) {
    try {
        const guard = await requireShop("product.listing.create", req)
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
        }
        const providerId = guard.provider.id

        const params = new URL(req.url).searchParams
        const q = (params.get("q") ?? "").trim().slice(0, 100)
        const category = params.get("category")
        const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "20", 10) || 20, 1), 50)

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

        const items = await prisma.catalogItem.findMany({
            where: { isActive: true, AND: and },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: limit,
            select: {
                id: true,
                name: true,
                nameAr: true,
                brand: true,
                unit: true,
                category: { select: { id: true, name: true } },
                // Lets the UI say "already in your products" instead of failing on save
                products: { where: { providerId }, select: { id: true }, take: 1 },
            },
        })

        return NextResponse.json({
            items: items.map(({ products, ...item }) => ({
                ...item,
                listedProductId: products[0]?.id ?? null,
            })),
        })
    } catch (error) {
        console.error("Catalogue search error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
