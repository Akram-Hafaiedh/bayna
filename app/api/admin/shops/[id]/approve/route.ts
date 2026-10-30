// app/api/admin/shops/[id]/approve/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { notifications, notify, shopPublicIds } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"
import { findOwnerRole } from "@/lib/access/role-seed"
import { Role } from "@/app/generated/prisma/enums"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requirePlatform("shop.application.approve", req)
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
        }

        const { id } = await params

        const shop = await prisma.shop.findUnique({
            where: { id },
        })

        if (!shop) {
            return NextResponse.json(
                { error: "Shop not found" },
                { status: 404 }
            )
        }

        if (shop.status === "ACTIVE") {
            return NextResponse.json({ error: "This shop is already approved" }, { status: 400 })
        }
        if (shop.status !== "PENDING") {
            return NextResponse.json({ error: "Only a shop waiting for approval can be approved" }, { status: 400 })
        }

        // The applicant becomes an owner of the business (which reaches every shop of it): they get the
        // business role that holds the ownership key (there is no special "Owner" role). A shop not
        // linked to a business keeps a shop-level owner.
        const businessId = shop.businessId
        const ownerScope = businessId ? "BUSINESS" : "SHOP"
        const ownerRole = await prisma.$transaction((tx) =>
            findOwnerRole(tx, businessId ? { businessId } : { shopId: id })
        )
        if (!ownerRole) {
            return NextResponse.json(
                { error: "This business has no role that can own it. Create one with the ownership permission, then approve again." },
                { status: 500 }
            )
        }
        const alreadyOwner = await prisma.accessAssignment.findFirst({
            where: businessId
                ? { userId: shop.applicantId, scope: "BUSINESS", businessId } // already works in the business, whatever the role
                : { userId: shop.applicantId, scope: "SHOP", shopId: id },
            select: { id: true },
        })

        const ownerRoleId = ownerRole.id
        await withAudit(guard.actor, async (tx) => {
            await tx.shop.update({
                where: { id },
                data: { status: "ACTIVE" },
            })
            await tx.user.update({
                where: { id: shop.applicantId },
                data: { role: Role.COMPANY },
            })
            if (!alreadyOwner) {
                await tx.accessAssignment.create({
                    data: {
                        userId: shop.applicantId,
                        roleId: ownerRoleId,
                        scope: ownerScope,
                        businessId: businessId ?? null,
                        shopId: businessId ? null : id,
                        status: "ACTIVE",
                        invitedById: guard.userId,
                    },
                })
            }
            await notify(tx, shop.applicantId, notifications.applicationApproved({ shop: (await shopPublicIds(tx, [id])).get(id)! }))
        })

        return NextResponse.json({ message: "Shop approved" })
    } catch (error) {
        console.error("Approve shop error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}