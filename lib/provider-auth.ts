// lib/provider-auth.ts
// Shared guard for provider API routes (replaces the copies in each route file).
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"

export type ProviderAuth =
    | { ok: true; provider: { id: string } }
    | { ok: false; error: string; status: 401 | 403 | 404 }

export async function getVerifiedProvider(): Promise<ProviderAuth> {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== Role.PROVIDER) {
        return { ok: false, error: "Unauthorized", status: 401 }
    }

    const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
        select: { id: true, isVerified: true },
    })

    if (!provider) {
        return { ok: false, error: "Provider profile not found", status: 404 }
    }
    if (!provider.isVerified) {
        return { ok: false, error: "Provider not verified yet", status: 403 }
    }

    return { ok: true, provider: { id: provider.id } }
}

/**
 * For Server Component pages (call inside a <Suspense> boundary).
 * Redirects non-providers; returns null when the user has no provider profile.
 */
export async function requireProvider() {
    await connection()
    const user = await requireRole([Role.PROVIDER])
    return prisma.provider.findUnique({
        where: { userId: user.id },
        select: { id: true, isVerified: true },
    })
}
