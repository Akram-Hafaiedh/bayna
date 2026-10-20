// app/api/admin/providers/[id]/approve/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { notifications, notify } from "@/lib/notifications"
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

        const provider = await prisma.provider.findUnique({
            where: { id },
        })

        if (!provider) {
            return NextResponse.json(
                { error: "Provider not found" },
                { status: 404 }
            )
        }

        if (provider.isVerified) {
            return NextResponse.json({ error: "This shop is already approved" }, { status: 400 })
        }

        // The applicant becomes an owner of the business (which reaches every shop of it): they get the
        // business role that holds the ownership key (there is no special "Owner" role). A shop not
        // linked to a business keeps a shop-level owner.
        const businessId = provider.businessId
        const ownerScope = businessId ? "BUSINESS" : "SHOP"
        const ownerRole = await prisma.$transaction((tx) =>
            findOwnerRole(tx, businessId ? { businessId } : { providerId: id })
        )
        if (!ownerRole) {
            return NextResponse.json(
                { error: "This business has no role that can own it. Create one with the ownership permission, then approve again." },
                { status: 500 }
            )
        }
        const alreadyOwner = await prisma.accessAssignment.findFirst({
            where: businessId
                ? { userId: provider.userId, scope: "BUSINESS", businessId } // already works in the business, whatever the role
                : { userId: provider.userId, scope: "SHOP", providerId: id },
            select: { id: true },
        })

        const ownerRoleId = ownerRole.id
        await withAudit(guard.actor, async (tx) => {
            await tx.provider.update({
                where: { id },
                data: { isVerified: true },
            })
            await tx.user.update({
                where: { id: provider.userId },
                data: { role: Role.PROVIDER },
            })
            if (!alreadyOwner) {
                await tx.accessAssignment.create({
                    data: {
                        userId: provider.userId,
                        roleId: ownerRoleId,
                        scope: ownerScope,
                        businessId: businessId ?? null,
                        providerId: businessId ? null : id,
                        status: "ACTIVE",
                        invitedById: guard.userId,
                    },
                })
            }
            await notify(tx, provider.userId, notifications.applicationApproved())
        })

        return NextResponse.json({ message: "Provider approved" })
    } catch (error) {
        console.error("Approve provider error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}