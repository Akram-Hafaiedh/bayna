// app/api/admin/catalog/[id]/route.ts
// PATCH /api/admin/catalog/:id   edit fields and/or { isActive }
// Linked products inherit unit and category from their catalogue item, so changing
// either one here is applied to every linked product in the same transaction.
//
// A changed unit makes every linked product's price doubtful (a price per piece is not a price per
// box). So the admin is first shown how many products and shops it affects and must confirm
// (resend with confirmUnitChange: true). Those products are then flagged for a price review and
// their shops are notified.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { parseCatalogFields } from "@/lib/catalogue/catalog-input"
import { countAffected, describeCounts, unitChangeReason, unitName } from "@/lib/products/price-review"
import { loadShopMembersWith } from "@/lib/access/members"
import { notifications, notify, shopPublicIds } from "@/lib/notifications"

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

        // A different unit needs a confirmation that says who is affected
        const unitChanged = fields.value.unit !== current.unit
        const linked = unitChanged
            ? await prisma.product.findMany({
                where: { catalogItemId: id },
                select: { id: true, shopId: true, deletedAt: true },
            })
            : []
        const live = linked.filter((p) => !p.deletedAt)
        if (unitChanged && live.length > 0 && body.confirmUnitChange !== true) {
            const counts = countAffected(live)
            return NextResponse.json(
                {
                    error: "Confirm the unit change",
                    needsConfirmation: true,
                    ...counts,
                    from: current.unit,
                    to: fields.value.unit,
                    message:
                        `Changing the unit from ${unitName(current.unit)} to ${unitName(fields.value.unit)} will flag ` +
                        `${describeCounts(counts)} for a price review. Their shops are notified and the products stay out of ` +
                        `comparison until the price is confirmed. Continue?`,
                },
                { status: 409 }
            )
        }

        const item = await withAudit(guard.actor, async (tx) => {
            const updated = await tx.catalogItem.update({
                where: { id },
                data: {
                    ...fields.value,
                    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
                },
            })
            const reason = unitChangeReason(current.unit, fields.value.unit)
            await tx.product.updateMany({
                where: { catalogItemId: id },
                data: {
                    unit: fields.value.unit,
                    categoryId: fields.value.categoryId,
                    ...(unitChanged ? { needsPriceReview: true, priceReviewReason: reason } : {}),
                },
            })

            // One notification per shop, to the people who may edit prices
            if (unitChanged && live.length > 0) {
                const perShop = new Map<string, number>()
                for (const p of live) perShop.set(p.shopId, (perShop.get(p.shopId) ?? 0) + 1)
                const members = await loadShopMembersWith(tx, [...perShop.keys()], "product.price.edit")
                const publicIds = await shopPublicIds(tx, [...perShop.keys()])
                for (const [shopId, count] of perShop) {
                    await notify(
                        tx,
                        members.get(shopId) ?? [],
                        notifications.priceReviewNeeded({ shop: publicIds.get(shopId)!, itemName: updated.name, reason, count })
                    )
                }
            }
            return updated
        })

        return NextResponse.json({ item })
    } catch (error) {
        console.error("Update catalogue item error:", error)
        return bad("Something went wrong", 500)
    }
}
