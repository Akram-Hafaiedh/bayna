// lib/access/guard.ts
// One place that answers "may this person do this?" for API routes. Replaces isAdmin(),
// getVerifiedProvider() and the inline `session.user.role !== ADMIN` checks.
//
//   const guard = await requirePlatform("catalog.item.create", req)
//   if (!guard.ok) return bad(guard.error, guard.status)
//   await withAudit(guard.actor, (tx) => tx.catalogItem.create({ ... }))
//
//   const guard = await requireShop("product.listing.edit", req)
//   if (!guard.ok) return bad(guard.error, guard.status)
//   guard.provider.id            // the shop the request is about
//   guard.can("product.price.edit")   // field-level checks inside the route
//
// 401 = not signed in (or login revoked). 403 = signed in but not allowed, or account not active.
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { requestMeta, type AuditActor, type RequestMeta } from "@/lib/audit/actor"
import type { PlatformPermission, ShopPermission } from "./catalogue"
import { effective, has, isLive, roleKeys } from "./evaluate"
import { loadAccess, type Access } from "./load"
import { pickActiveShop } from "./active-shop"
import { readActiveShopHint } from "./active-cookie"

export type GuardFail = { ok: false; error: string; status: 401 | 403 | 404 }

export type PlatformGuard = {
    ok: true
    userId: string
    access: Access
    actor: AuditActor
    can: (key: PlatformPermission) => boolean
}

export type ShopGuard = {
    ok: true
    userId: string
    access: Access
    provider: { id: string }
    actor: AuditActor
    can: (key: ShopPermission) => boolean
}

const fail = (error: string, status: GuardFail["status"]): GuardFail => ({ ok: false, error, status })

const STATUS_MESSAGE: Record<string, string> = {
    SUSPENDED: "Your account is suspended",
    BANNED: "Your account has been closed",
    PENDING_DELETION: "Your account is scheduled for deletion",
}

async function authenticate(req?: Request): Promise<{ ok: true; access: Access; meta: RequestMeta } | GuardFail> {
    const session = await auth()
    if (!session?.user?.id) return fail("Unauthorized", 401)

    const access = await loadAccess(session.user.id)
    if (!access) return fail("Unauthorized", 401)
    if (access.status !== "ACTIVE") return fail(STATUS_MESSAGE[access.status] ?? "Forbidden", 403)

    return { ok: true, access, meta: req ? requestMeta(req) : {} }
}

function actorFor(access: Access, meta: RequestMeta, roleLabel: string): AuditActor {
    return {
        actorId: access.userId,
        actorName: access.name || access.email,
        actorRole: roleLabel || null,
        source: "WEB",
        ...meta,
    }
}

/** Platform staff action (admin, support, moderation, catalogue, finance). */
export async function requirePlatform(key: PlatformPermission, req?: Request): Promise<PlatformGuard | GuardFail> {
    const a = await authenticate(req)
    if (!a.ok) return a

    const now = new Date()
    const eff = effective(a.access.assignments, {}, now)
    if (!has(eff, key)) return fail("Forbidden", 403)

    return {
        ok: true,
        userId: a.access.userId,
        access: a.access,
        actor: actorFor(a.access, a.meta, roleKeys(a.access.assignments, {}, now).join(",")),
        can: (k) => has(eff, k),
    }
}

/**
 * Action inside a shop. The shop is chosen from the person's own live assignments: the one they
 * switched to (remembered in a cookie that is checked every time, never trusted), else the first
 * by id. A caller may force a shop with `opts.providerId`; that still has to be one they work in.
 */
export async function requireShop(
    key: ShopPermission,
    req?: Request,
    opts: { providerId?: string } = {}
): Promise<ShopGuard | GuardFail> {
    const a = await authenticate(req)
    if (!a.ok) return a

    const now = new Date()
    const shopIds = [
        ...new Set(
            a.access.assignments
                .filter((x) => x.scope === "SHOP" && x.providerId && isLive(x, now))
                .map((x) => x.providerId as string)
        ),
    ].sort()

    let providerId = opts.providerId
    if (providerId) {
        if (!shopIds.includes(providerId)) return fail("Forbidden", 403)
    } else if (shopIds.length === 0) {
        // An applicant still waiting for approval has no assignment yet; keep the clearer message.
        const pending = await prisma.provider.findFirst({
            where: { userId: a.access.userId, isVerified: false, deletedAt: null },
            select: { id: true },
        })
        if (pending) return fail("Provider not verified yet", 403)
        return fail("Forbidden", 403)
    } else {
        providerId = pickActiveShop(shopIds, await readActiveShopHint()) ?? shopIds[0]
    }

    const provider = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { id: true, isVerified: true, deletedAt: true },
    })
    if (!provider || provider.deletedAt) return fail("Provider profile not found", 404)
    if (!provider.isVerified) return fail("Provider not verified yet", 403)

    const ctx = { providerId: provider.id }
    const eff = effective(a.access.assignments, ctx, now)
    if (!has(eff, key)) return fail("Forbidden", 403)

    const label = roleKeys(a.access.assignments, ctx, now).map((r) => `shop:${r}`).join(",")
    return {
        ok: true,
        userId: a.access.userId,
        access: a.access,
        provider: { id: provider.id },
        actor: actorFor(a.access, a.meta, label),
        can: (k) => has(eff, k),
    }
}
