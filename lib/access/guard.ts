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
import type { BusinessPermission, PlatformPermission, ShopPermission } from "./catalogue"
import { effective, has, roleNames } from "./evaluate"
import { loadAccess, type Access } from "./load"
import { pickActiveShop } from "./active-shop"
import { SHOP_HEADER } from "@/lib/shop-paths"
import { reachableBusinessIds, reachableShopIds } from "./reach"
import { readActiveShopHint } from "./active-cookie"
import { pickActiveBusiness } from "./active-business"
import { readActiveBusinessHint } from "./active-business-cookie"

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
    provider: { id: string; businessId: string | null }
    actor: AuditActor
    can: (key: ShopPermission) => boolean
}

export type BusinessGuard = {
    ok: true
    userId: string
    access: Access
    business: { id: string }
    actor: AuditActor
    can: (key: BusinessPermission | ShopPermission) => boolean
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
        actor: actorFor(a.access, a.meta, roleNames(a.access.assignments, {}, now).join(", ")),
        can: (k) => has(eff, k),
    }
}

/**
 * Action inside a shop. The shop is the one the page names: the browser sends its public id in the
 * x-shop header (see lib/shop-fetch.ts), so two tabs on two shops never mix. Without the header the
 * one they last switched to (a cookie that is checked every time, never trusted), else the first by
 * id. A caller may force a shop with `opts.providerId`. Whichever way, it has to be a shop they work in.
 */
export async function requireShop(
    key: ShopPermission,
    req?: Request,
    opts: { providerId?: string } = {}
): Promise<ShopGuard | GuardFail> {
    const a = await authenticate(req)
    if (!a.ok) return a

    const now = new Date()
    // Own shops plus every shop of the businesses the person is a business-level member of
    const shopIds = reachableShopIds(a.access.assignments, a.access.businessShops, now)

    let providerId = opts.providerId
    if (providerId) {
        if (!shopIds.includes(providerId)) return fail("Forbidden", 403)
    } else if (shopIds.length === 0) {
        // An applicant still waiting for approval has no assignment yet; keep the clearer message.
        const pending = await prisma.shop.findFirst({
            where: { userId: a.access.userId, status: { in: ["DRAFT", "PENDING"] }, deletedAt: null },
            select: { id: true },
        })
        if (pending) return fail("Your shop is not approved yet", 403)
        return fail("Forbidden", 403)
    } else {
        const asked = req?.headers.get(SHOP_HEADER)?.trim()
        if (asked) {
            const named = await prisma.shop.findUnique({ where: { publicShopId: asked }, select: { id: true } })
            if (!named || !shopIds.includes(named.id)) return fail("Forbidden", 403)
            providerId = named.id
        } else {
            providerId = pickActiveShop(shopIds, await readActiveShopHint()) ?? shopIds[0]
        }
    }

    const provider = await prisma.shop.findUnique({
        where: { id: providerId },
        select: { id: true, status: true, deletedAt: true, businessId: true },
    })
    if (!provider || provider.deletedAt) return fail("Shop not found", 404)
    if (provider.status === "PENDING" || provider.status === "DRAFT") return fail("Your shop is not approved yet", 403)
    if (provider.status !== "ACTIVE") return fail("This shop is closed or suspended", 403)

    // businessId lets a business-level role (owner, accountant) count inside this shop
    const ctx = { providerId: provider.id, businessId: provider.businessId }
    const eff = effective(a.access.assignments, ctx, now)
    if (!has(eff, key)) return fail("Forbidden", 403)

    const label = roleNames(a.access.assignments, ctx, now).map((r) => `shop:${r}`).join(", ")
    return {
        ok: true,
        userId: a.access.userId,
        access: a.access,
        provider: { id: provider.id, businessId: provider.businessId },
        actor: actorFor(a.access, a.meta, label),
        can: (k) => has(eff, k),
    }
}

/**
 * Action on a business (legal and billing details, business-level team). The business is the one
 * chosen in the Business area; without a choice, the one the active shop belongs to; else the first
 * they belong to. Needs a business-level assignment: being a shop manager does not open the business.
 */
export async function requireBusiness(
    key: BusinessPermission | ShopPermission,
    req?: Request,
    opts: { businessId?: string } = {}
): Promise<BusinessGuard | GuardFail> {
    const a = await authenticate(req)
    if (!a.ok) return a

    const now = new Date()
    const reachable = reachableBusinessIds(a.access.assignments, now)

    // A caller may name the business (the team routes act on the business of a member or invite);
    // it still has to be one the person belongs to at business level.
    if (opts.businessId && !reachable.includes(opts.businessId)) return fail("Forbidden", 403)

    let businessId: string | null = opts.businessId ?? null
    if (!businessId) {
        // The business chosen in the Business area (a cookie, checked), else the business of the
        // shop they are working in, else the first one they belong to.
        const hint = await readActiveBusinessHint()
        let ofActiveShop: string | null = null
        if (!(hint && reachable.includes(hint))) {
            const shopIds = reachableShopIds(a.access.assignments, a.access.businessShops, now)
            const activeShop = pickActiveShop(shopIds, await readActiveShopHint())
            if (activeShop) {
                const shop = await prisma.shop.findUnique({ where: { id: activeShop }, select: { businessId: true } })
                ofActiveShop = shop?.businessId ?? null
            }
        }
        businessId = pickActiveBusiness(reachable, hint, ofActiveShop)
    }
    if (!businessId) return fail("Forbidden", 403)

    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, deletedAt: true } })
    if (!business || business.deletedAt) return fail("Business not found", 404)

    const ctx = { businessId: business.id }
    const eff = effective(a.access.assignments, ctx, now)
    if (!has(eff, key)) return fail("Forbidden", 403)

    const label = roleNames(a.access.assignments, ctx, now).map((r) => `business:${r}`).join(", ")
    return {
        ok: true,
        userId: a.access.userId,
        access: a.access,
        business: { id: business.id },
        actor: actorFor(a.access, a.meta, label),
        can: (k) => has(eff, k),
    }
}
