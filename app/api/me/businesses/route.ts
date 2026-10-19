// app/api/me/businesses/route.ts
// GET: the businesses the signed-in person holds a business-level role in, and the active one.
// Feeds the "Business" entry in the account menu (shown only when this list is not empty).
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { loadMyBusinesses } from "@/lib/access/my-businesses"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        const mine = await loadMyBusinesses(session.user.id)
        return NextResponse.json({ businesses: mine?.businesses ?? [], activeId: mine?.activeId ?? null })
    } catch (error) {
        console.error("List my businesses error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
