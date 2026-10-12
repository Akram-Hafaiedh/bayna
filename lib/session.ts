// lib/session.ts
// Helper functions for authentication & authorization

import { auth } from "@/auth"
import { Role } from "@/app/generated/prisma/enums"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
    const session = await auth()
    return session?.user?.id ? session.user : null
}

export async function requireAuth() {
    const user = await getCurrentUser()
    if (!user) {
        redirect("/login")
    }
    return user
}

export async function requireRole(allowedRoles: Role[]) {
    const user = await requireAuth()

    if (!allowedRoles.includes(user.role as Role)) {
        // Redirect to the correct dashboard based on their actual role
        if (user.role === Role.CLIENT) redirect("/dashboard")
        if (user.role === Role.PROVIDER) redirect("/provider/dashboard")
        if (user.role === Role.ADMIN) redirect("/admin/dashboard")
        redirect("/")
    }

    return user
}
