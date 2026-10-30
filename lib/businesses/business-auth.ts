// lib/businesses/business-auth.ts
// Helper for the Business area's Server Component pages (call inside a <Suspense> boundary).
// Sends people who hold no business-level role back to the shop dashboard, and returns the
// business being shown (the one chosen in the picker). Pages only use this to decide what to show:
// every API route checks permissions itself.
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { Role } from "@/app/generated/prisma/enums"
import { requireRole } from "@/lib/auth/session"
import { loadMyBusinesses, type MyBusiness } from "@/lib/access/my-businesses"
import type { Access } from "@/lib/access/load"

export async function requireBusinessArea(): Promise<{
    userId: string
    access: Access
    business: MyBusiness
    businesses: MyBusiness[]
}> {
    await connection()
    const user = await requireRole([Role.COMPANY])
    const mine = await loadMyBusinesses(user.id)
    const business = mine?.businesses.find((b) => b.id === mine.activeId)
    if (!mine || !business) redirect("/shop")
    return { userId: user.id, access: mine.access, business, businesses: mine.businesses }
}
