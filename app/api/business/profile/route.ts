// app/api/business/profile/route.ts
// The business behind the shop the person is working in: legal and billing details.
// GET shows it, PATCH edits it. Needs a business-level role; being a shop manager is not enough.
// Legal fields (legal name, tax number, registry number) also need business.profile.edit_legal.
// Every change is written to the activity log by withAudit.
import { NextResponse } from "next/server"
import { requireBusiness } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { parseBusinessFields } from "@/lib/businesses/business-input"

const SELECT = {
    id: true,
    name: true,
    legalName: true,
    taxId: true,
    registryNumber: true,
    billingEmail: true,
    billingPhone: true,
    billingAddress: true,
} as const

export async function GET(req: Request) {
    try {
        const guard = await requireBusiness("business.profile.view", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const business = await prisma.business.findUnique({ where: { id: guard.business.id }, select: SELECT })
        if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

        return NextResponse.json({
            business,
            canEdit: guard.can("business.profile.edit"),
            canEditLegal: guard.can("business.profile.edit_legal"),
        })
    } catch (error) {
        console.error("Get business error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const guard = await requireBusiness("business.profile.edit", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const current = await prisma.business.findUnique({ where: { id: guard.business.id }, select: SELECT })
        if (!current) return NextResponse.json({ error: "Business not found" }, { status: 404 })

        const body = await req.json().catch(() => null)
        const parsed = parseBusinessFields(body, current)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { data, changed, legal } = parsed.value

        if (legal && !guard.can("business.profile.edit_legal")) {
            return NextResponse.json(
                { error: "Only the business owner can change the legal name, tax number or registry number" },
                { status: 403 }
            )
        }
        if (changed.length === 0) return NextResponse.json({ business: current, changed })

        const business = await withAudit(guard.actor, (tx) =>
            tx.business.update({ where: { id: current.id }, data, select: SELECT })
        )
        return NextResponse.json({ business, changed })
    } catch (error) {
        console.error("Update business error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
