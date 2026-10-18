// app/api/me/shops/route.ts
// GET: the shops the signed-in person works in, plus applications still waiting, and which one is
// active right now. Feeds the shop switcher.
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { loadMyShops } from "@/lib/access/shops"
import { pickActiveShop } from "@/lib/access/active-shop"
import { readActiveShopHint } from "@/lib/access/active-cookie"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const shops = await loadMyShops(session.user.id)
        const activeId = pickActiveShop(
            shops.filter((s) => s.status === "ACTIVE").map((s) => s.id),
            await readActiveShopHint()
        )
        return NextResponse.json({ shops, activeId })
    } catch (error) {
        console.error("List my shops error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
