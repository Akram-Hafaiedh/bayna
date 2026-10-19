// app/api/me/active-business/route.ts
// POST { businessId }: choose which business the Business area shows.
// It must be a business the person holds a business-level role in right now; anything else is refused.
// The cookie only remembers the choice. Every request checks it again (see pickActiveBusiness).
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { loadMyBusinesses } from "@/lib/access/my-businesses"
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/access/active-business"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json().catch(() => null)
        const businessId = typeof body?.businessId === "string" ? body.businessId : ""

        const mine = await loadMyBusinesses(session.user.id)
        const business = mine?.businesses.find((b) => b.id === businessId)
        if (!business) return NextResponse.json({ error: "You do not manage that business" }, { status: 403 })

        const res = NextResponse.json({ activeId: business.id, name: business.name })
        res.cookies.set(ACTIVE_BUSINESS_COOKIE, business.id, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        })
        return res
    } catch (error) {
        console.error("Switch business error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
