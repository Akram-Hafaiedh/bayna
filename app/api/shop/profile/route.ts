// app/api/shop/profile/route.ts
// The shop's own profile. GET shows it, PATCH edits it.
// A verified shop's edits to phone, WhatsApp and description save straight away. Edits to name,
// address, city, governorate or location also save (the shop stays live) but raise `needsReview`
// so an admin looks at them. Every change is written to the activity log by withAudit.
import { NextResponse } from "next/server"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { prisma } from "@/lib/prisma"
import { parseProfileFields } from "@/lib/shops/shop-input"

const SELECT = {
    id: true,
    name: true,
    description: true,
    phone: true,
    whatsapp: true,
    address: true,
    city: true,
    governorate: true,
    latitude: true,
    longitude: true,
    locationSource: true,
    status: true,
    needsReview: true,
} as const

type Row = NonNullable<Awaited<ReturnType<typeof load>>>

function load(id: string) {
    return prisma.shop.findUnique({ where: { id }, select: SELECT })
}

/** Shop rows saved before the map existed have coordinates but no source: they were imported. */
function present(p: Row, canEdit: boolean) {
    const hasPin = p.latitude != null && p.longitude != null
    return { ...p, locationSource: p.locationSource ?? (hasPin ? "IMPORTED" : null), canEdit }
}

export async function GET(req: Request) {
    try {
        const guard = await requireShop("shop.profile.view", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const shop = await load(guard.shop.id)
        if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

        return NextResponse.json({ shop: present(shop, guard.can("shop.profile.edit")) })
    } catch (error) {
        console.error("Get shop profile error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const guard = await requireShop("shop.profile.edit", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const body = await req.json().catch(() => null)
        const current = await load(guard.shop.id)
        if (!current) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

        const parsed = parseProfileFields(body, current)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { data, changed, sensitive } = parsed.value
        if (data.phone === null) {
            return NextResponse.json({ error: "A phone number is required" }, { status: 400 })
        }

        if (changed.length === 0) {
            return NextResponse.json({ shop: present(current, true), changed, flaggedForReview: false })
        }

        const flag = current.status === "ACTIVE" && sensitive
        const updated = await withAudit(guard.actor, (tx) =>
            tx.shop.update({
                where: { id: current.id },
                data: { ...data, ...(flag ? { needsReview: true } : {}) },
                select: SELECT,
            })
        )

        return NextResponse.json({ shop: present(updated, true), changed, flaggedForReview: flag })
    } catch (error) {
        console.error("Update shop profile error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
