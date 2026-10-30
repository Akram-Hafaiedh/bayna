// app/api/me/active-shop/route.ts
// POST { shopId }: switch the shop the signed-in person is working in.
// The shop must be one they work in right now (a live assignment); anything else is refused.
// The cookie only remembers the choice. Every request checks it again (see pickActiveShop).
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { loadMyShops } from "@/lib/access/shops"
import { ACTIVE_SHOP_COOKIE } from "@/lib/access/active-shop"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json().catch(() => null)
        const shopId = typeof body?.shopId === "string" ? body.shopId : ""

        const shops = await loadMyShops(session.user.id)
        const shop = shops.find((s) => s.id === shopId && s.status === "ACTIVE")
        if (!shop) return NextResponse.json({ error: "You do not work in that shop" }, { status: 403 })

        const res = NextResponse.json({ activeId: shop.id, name: shop.name })
        res.cookies.set(ACTIVE_SHOP_COOKIE, shop.id, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        })
        return res
    } catch (error) {
        console.error("Switch shop error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
