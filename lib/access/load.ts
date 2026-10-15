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
                    status: true,
                    expiresAt: true,
                    grants: true,
                    denies: true,
                    role: { select: { key: true, permissions: true } },
                },
            },
        },
    })
    if (!user || user.deletedAt) return null

    return {
        userId: user.id,
        name: user.name,
        email: user.email,
        routingRole: user.role,
        status: user.status,
        assignments: user.accessAssignments,
    }
})
