// lib/access/load.ts
// Reads a user's account state and assignments. Nothing is cached across requests, so a role
// change, suspension or revoked assignment applies on the very next request.
import { cache } from "react"
import { prisma } from "@/lib/prisma"
import type { Role, UserStatus } from "@/app/generated/prisma/enums"
import type { AssignmentInput } from "./evaluate"

export type Access = {
    userId: string
    name: string | null
    email: string
    /** Only for deciding which dashboard to open. Never used to authorize. */
    routingRole: Role
    status: UserStatus
    assignments: AssignmentInput[]
    /** For each business the person holds a business-level assignment for: that business's approved shops */
    businessShops: Record<string, string[]>
}

export const loadAccess = cache(async (userId: string): Promise<Access | null> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            deletedAt: true,
            accessAssignments: {
                select: {
                    scope: true,
                    providerId: true,
                    businessId: true,
                    status: true,
                    expiresAt: true,
                    role: { select: { name: true, permissions: true } },
                },
            },
        },
    })
    if (!user || user.deletedAt) return null

    // Business-level assignments reach every shop of the business: find those shops
    const businessIds = [
        ...new Set(user.accessAssignments.flatMap((a) => (a.scope === "BUSINESS" && a.businessId ? [a.businessId] : []))),
    ]
    const businessShops: Record<string, string[]> = {}
    if (businessIds.length > 0) {
        const shops = await prisma.shop.findMany({
            // approved shops only: a shop still waiting for approval cannot be worked in
            where: { businessId: { in: businessIds }, deletedAt: null, isVerified: true },
            select: { id: true, businessId: true },
        })
        for (const s of shops) {
            if (!s.businessId) continue
                ; (businessShops[s.businessId] ??= []).push(s.id)
        }
    }

    return {
        userId: user.id,
        name: user.name,
        email: user.email,
        routingRole: user.role,
        status: user.status,
        assignments: user.accessAssignments,
        businessShops,
    }
})
