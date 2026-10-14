// app/api/admin/suggestions/[id]/reject/route.ts
// POST { reviewNote? } - the provider keeps their custom product; only the request is closed.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/admin-auth"
import { parseText } from "@/lib/product-input"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAdmin())) return bad("Unauthorized", 401)
        const { id } = await params

        const body = await req.json().catch(() => ({}))
        const note = parseText(body.reviewNote, "Note", 500)
        if (!note.ok) return bad(note.error)

        const result = await prisma.catalogSuggestion.updateMany({
            where: { id, status: "PENDING" },
            data: { status: "REJECTED", reviewNote: note.value, reviewedAt: new Date() },
        })
        if (result.count === 0) return bad("Request not found or already reviewed", 404)

        return NextResponse.json({ message: "Request rejected" })
    } catch (error) {
        console.error("Reject suggestion error:", error)
        return bad("Something went wrong", 500)
    }
}
