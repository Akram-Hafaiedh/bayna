// lib/admin-auth.ts
// Shared guard for admin API routes.
import { auth } from "@/auth"
import { Role } from "@/app/generated/prisma/enums"

export async function isAdmin(): Promise<boolean> {
    const session = await auth()
    return Boolean(session?.user?.id && session.user.role === Role.ADMIN)
}
