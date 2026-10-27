// app/api/admin/messages/[id]/route.ts
// PATCH { status }: the team marks a contact message as new, read or handled. Needs
// support.ticket.change_status. Written to the activity log by withAudit.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { isContactStatus } from "@/lib/contact"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requirePlatform("support.ticket.change_status", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const { id } = await params
        const body = (await req.json().catch(() => null)) as { status?: unknown } | null
        if (!isContactStatus(body?.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 })
        const status = body.status

        const found = await prisma.contactMessage.findUnique({ where: { id }, select: { id: true } })
        if (!found) return NextResponse.json({ error: "Message not found" }, { status: 404 })

        await withAudit(guard.actor, (tx) =>
            tx.contactMessage.update({
                where: { id },
                data: {
                    status,
                    handledAt: status === "HANDLED" ? new Date() : null,
                    handledById: status === "HANDLED" ? guard.userId : null,
                },
                select: { id: true },
            })
        )
        return NextResponse.json({ status })
    } catch (error) {
        console.error("Update contact message error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
