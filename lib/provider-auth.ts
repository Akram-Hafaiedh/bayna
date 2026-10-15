// lib/provider-auth.ts
// Helpers for provider Server Component pages. API routes use requireShop() from lib/access/guard.
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"

/**
 * For Server Component pages (call inside a <Suspense> boundary).
 * Redirects non-providers. Returns the person's shop, found through their shop assignment, or null
 * when they have none. An applicant still waiting for approval has no assignment yet, so the shop
 * they applied for is returned (not verified) so the page can show the pending state. Pages do not
 * authorize anything with this: every API route checks permissions itself.
 */
export async function requireProvider() {
    await connection()
    const user = await requireRole([Role.PROVIDER])

    const assignment = await prisma.accessAssignment.findFirst({
        where: { userId: user.id, scope: "SHOP", status: "ACTIVE", providerId: { not: null } },
        orderBy: { providerId: "asc" },
        select: { provider: { select: { id: true, isVerified: true } } },
    })
    if (assignment?.provider) return assignment.provider

    return prisma.provider.findUnique({
        where: { userId: user.id },
        select: { id: true, isVerified: true },
    })
}
