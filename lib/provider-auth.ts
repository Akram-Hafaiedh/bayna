// lib/provider-auth.ts
// Helpers for provider Server Component pages. API routes use requireShop() from lib/access/guard.
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"
import { pickActiveShop } from "@/lib/access/active-shop"
import { readActiveShopHint } from "@/lib/access/active-cookie"

/**
 * For Server Component pages (call inside a <Suspense> boundary).
 * Redirects non-providers. Returns the shop the person is working in: the one they switched to
 * (a cookie that is checked against their live assignments), else the first by id; null when they
 * have none. An applicant still waiting for approval has no assignment yet, so the shop they
 * applied for is returned (not verified) so the page can show the pending state. Pages do not
 * authorize anything with this: every API route checks permissions itself.
 */
export async function requireProvider() {
    await connection()
    const user = await requireRole([Role.PROVIDER])

    const now = new Date()
    const assignments = await prisma.accessAssignment.findMany({
        where: {
            userId: user.id,
            scope: "SHOP",
            status: "ACTIVE",
            providerId: { not: null },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            provider: { deletedAt: null },
        },
        select: { provider: { select: { id: true, isVerified: true, businessName: true } } },
    })
    const shops = assignments.flatMap((a) => (a.provider ? [a.provider] : []))
    const chosen = pickActiveShop(shops.map((s) => s.id), await readActiveShopHint())
    const shop = shops.find((s) => s.id === chosen)
    if (shop) return shop

    return prisma.provider.findFirst({
        where: { userId: user.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, isVerified: true, businessName: true },
    })
}
