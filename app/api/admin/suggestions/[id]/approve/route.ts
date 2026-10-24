// app/api/admin/suggestions/[id]/approve/route.ts
// POST { catalogItemId? } or { name, nameAr, brand, unit, categoryId, description }
//   without catalogItemId: creates a new catalogue item. Fields default to the request's
//   values; the admin can send corrected ones.
//   with catalogItemId:    merges the request into that existing item
// Either way the provider's product is linked to the item, so it joins price comparisons.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { slugify } from "@/lib/slug"
import { parseCatalogFields, uniqueCatalogSlug } from "@/lib/catalog-input"
import { unitChangeReason } from "@/lib/price-review"
import { loadShopMembersWith } from "@/lib/access/members"
import { notifications, notify, shopPublicIds } from "@/lib/notifications"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("catalog.suggestion.review", req)
        if (!guard.ok) return bad(guard.error, guard.status)
        const { id } = await params

        const body = await req.json().catch(() => ({}))
        const mergeId = typeof body.catalogItemId === "string" && body.catalogItemId ? body.catalogItemId : null

        const suggestion = await prisma.catalogSuggestion.findUnique({ where: { id } })
        if (!suggestion) return bad("Request not found", 404)
        if (suggestion.status !== "PENDING") return bad("This request was already reviewed", 409)

        let item: { id: string; name: string; unit: typeof suggestion.unit; categoryId: string }
        if (mergeId) {
            const existing = await prisma.catalogItem.findFirst({
                where: { id: mergeId, isActive: true },
                select: { id: true, name: true, unit: true, categoryId: true },
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
                select: { id: true, deletedAt: true },
            })
            if (clash) {
                return bad(
                    clash.deletedAt
                        ? "This shop removed that catalogue item earlier. Ask them to list it again instead of merging."
                        : "This shop already lists that catalogue item",
                    409
                )
            }
        } else {
            // Corrected fields from the admin win over what the provider typed
            const fields = await parseCatalogFields({
                name: suggestion.name,
                nameAr: suggestion.nameAr,
                brand: suggestion.brand,
                unit: suggestion.unit,
                categoryId: suggestion.categoryId,
                ...body,
            })
            if (!fields.ok) return bad(fields.error)

            const category = await prisma.category.findUnique({
                where: { id: fields.value.categoryId },
                select: { slug: true },
            })
            const slug = await uniqueCatalogSlug(slugify(`${category?.slug ?? ""}-${fields.value.name}`))
            item = await withAudit(guard.actor, (tx) =>
                tx.catalogItem.create({
                    data: { ...fields.value, slug },
                    select: { id: true, name: true, unit: true, categoryId: true },
                })
            )
        }

        const approved = item
        // The product takes the catalogue item's unit. If that differs from the unit the shop priced it
        // in, the price is doubtful, so it is flagged and the shop is told.
        const product = suggestion.productId
            ? await prisma.product.findUnique({
                where: { id: suggestion.productId },
                select: { unit: true, providerId: true, deletedAt: true },
            })
            : null
        const unitDiffers = !!product && product.unit !== approved.unit
        await withAudit(guard.actor, async (tx) => {
            await tx.catalogSuggestion.update({
                where: { id },
                data: { status: "APPROVED", catalogItemId: approved.id, reviewedAt: new Date() },
            })
            if (suggestion.productId) {
                await tx.product.update({
                    where: { id: suggestion.productId },
                    // Linked products inherit unit and category from the catalogue item
                    data: {
                        catalogItemId: approved.id,
                        unit: approved.unit,
                        categoryId: approved.categoryId,
                        ...(unitDiffers && product
                            ? { needsPriceReview: true, priceReviewReason: unitChangeReason(product.unit, approved.unit) }
                            : {}),
                    },
                })
                if (unitDiffers && product && !product.deletedAt) {
                    const members = await loadShopMembersWith(tx, [product.providerId], "product.price.edit")
                    const publicIds = await shopPublicIds(tx, [product.providerId])
                    await notify(
                        tx,
                        members.get(product.providerId) ?? [],
                        notifications.priceReviewNeeded({
                            shop: publicIds.get(product.providerId)!,
                            itemName: approved.name,
                            reason: unitChangeReason(product.unit, approved.unit),
                            count: 1,
                        })
                    )
                }
            }
        })

        return NextResponse.json({ message: "Request approved", catalogItemId: item.id })
    } catch (error) {
        console.error("Approve suggestion error:", error)
        return bad("Something went wrong", 500)
    }
}