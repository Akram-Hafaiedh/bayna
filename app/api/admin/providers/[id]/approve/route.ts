// app/api/admin/providers/[id]/approve/route.ts
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { notifications, notify } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"
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

        // The applicant becomes OWNER of the shop. Permissions come from this assignment.
        const ownerRole = await prisma.accessRole.findFirst({
            where: { scope: "SHOP", providerId: null, key: "OWNER" },
            select: { id: true },
        })
        if (!ownerRole) {
            return NextResponse.json(
                { error: "Access roles are not set up. Run: npm run access:sync" },
                { status: 500 }
            )
        }
        const alreadyOwner = await prisma.accessAssignment.findFirst({
            where: { userId: provider.userId, providerId: id, roleId: ownerRole.id },
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
                        scope: "SHOP",
                        providerId: id,
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