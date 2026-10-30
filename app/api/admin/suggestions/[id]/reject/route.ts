// app/api/admin/suggestions/[id]/reject/route.ts
// POST { reviewNote? } - the shop keeps their custom product; only the request is closed.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { parseText } from "@/lib/products/product-input"

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
        const note = parseText(body.reviewNote, "Note", 500)
        if (!note.ok) return bad(note.error)

        const result = await withAudit(guard.actor, (tx) =>
            tx.catalogSuggestion.updateMany({
                where: { id, status: "PENDING" },
                data: { status: "REJECTED", reviewNote: note.value, reviewedAt: new Date() },
            })
        )
        if (result.count === 0) return bad("Request not found or already reviewed", 404)

        return NextResponse.json({ message: "Request rejected" })
    } catch (error) {
        console.error("Reject suggestion error:", error)
        return bad("Something went wrong", 500)
    }
}
