// app/api/admin/suggestions/[id]/approve/route.ts
// POST { catalogItemId? }
//   without catalogItemId: creates a new catalogue item from the request
//   with catalogItemId:    merges the request into that existing item
// Either way the provider's product is linked to the item, so it joins price comparisons.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/admin-auth"
import { slugify } from "@/lib/slug"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAdmin())) return bad("Unauthorized", 401)
        const { id } = await params

        const body = await req.json().catch(() => ({}))
        const mergeId = typeof body.catalogItemId === "string" && body.catalogItemId ? body.catalogItemId : null

        const suggestion = await prisma.catalogSuggestion.findUnique({
            where: { id },
            include: { category: { select: { slug: true } } },
        })
        if (!suggestion) return bad("Request not found", 404)
        if (suggestion.status !== "PENDING") return bad("This request was already reviewed", 409)

        let item: { id: string; unit: typeof suggestion.unit; categoryId: string }
        if (mergeId) {
            const existing = await prisma.catalogItem.findFirst({
                where: { id: mergeId, isActive: true },
                select: { id: true, unit: true, categoryId: true },
            })
            if (!existing) return bad("Catalogue item not found", 404)
            item = existing

            // The provider may already list the target item
            const clash = await prisma.product.findFirst({
                where: {
                    providerId: suggestion.providerId,
                    catalogItemId: existing.id,
                    NOT: { id: suggestion.productId ?? undefined },
                },
                select: { id: true },
            })
            if (clash) return bad("This provider already lists that catalogue item", 409)
        } else {
            const base = slugify(`${suggestion.category.slug}-${suggestion.name}`)
            let slug = base
            for (let n = 2; await prisma.catalogItem.findUnique({ where: { slug }, select: { id: true } }); n++) {
                slug = `${base}-${n}`
            }
            item = await prisma.catalogItem.create({
                data: {
                    name: suggestion.name,
                    nameAr: suggestion.nameAr,
                    brand: suggestion.brand,
                    unit: suggestion.unit,
                    categoryId: suggestion.categoryId,
                    slug,
                },
                select: { id: true, unit: true, categoryId: true },
            })
        }

        await prisma.$transaction([
            prisma.catalogSuggestion.update({
                where: { id },
                data: { status: "APPROVED", catalogItemId: item.id, reviewedAt: new Date() },
            }),
            ...(suggestion.productId
                ? [
                    prisma.product.update({
                        where: { id: suggestion.productId },
                        // Linked products inherit unit and category from the catalogue item
                        data: { catalogItemId: item.id, unit: item.unit, categoryId: item.categoryId },
                    }),
                ]
                : []),
        ])

        return NextResponse.json({ message: "Request approved", catalogItemId: item.id })
    } catch (error) {
        console.error("Approve suggestion error:", error)
        return bad("Something went wrong", 500)
    }
}
