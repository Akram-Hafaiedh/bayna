// app/api/admin/providers/[id]/reject/route.ts
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
        const guard = await requirePlatform("shop.application.reject", req)
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

        // Only a waiting application can be rejected; an approved shop is closed another way
        if (provider.isVerified) {
            return NextResponse.json({ error: "This shop is already approved" }, { status: 400 })
        }

        // Remove the application. The person goes back to CLIENT only when this was their only way
        // in: someone who already runs another shop stays a provider.
        await withAudit(guard.actor, async (tx) => {
            await tx.provider.delete({ where: { id } })
            const otherShops = await tx.accessAssignment.count({
                where: { userId: provider.userId, scope: "SHOP", status: "ACTIVE", providerId: { not: id } },
            })
            if (otherShops === 0) {
                await tx.user.update({
                    where: { id: provider.userId },
                    data: { role: Role.CLIENT },
                })
            }
            await notify(tx, provider.userId, notifications.applicationRejected())
        })

        return NextResponse.json({ message: "Provider application rejected" })
    } catch (error) {
        console.error("Reject provider error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
