// lib/shops/shop-auth.ts
// Helpers for the shop pages (Server Components). API routes use requireShop() from lib/access/guard.
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"
import { requireRole } from "@/lib/auth/session"
import { pickActiveShop } from "@/lib/access/active-shop"
import { readActiveShopHint } from "@/lib/access/active-cookie"
import { loadMyShops } from "@/lib/access/shops"
import { shopPath } from "@/lib/shops/shop-paths"
import type { ShopStatusValue } from "@/lib/shops/shop-status"

export type ShopPage = { id: string; publicShopId: string; name: string; status: ShopStatusValue }

const select = { id: true, publicShopId: true, name: true, status: true } as const

/**
 * For the pages under /shop/[publicShopId] (call inside a <Suspense> boundary).
 * The shop comes from the address, never from a cookie. It must be a shop the person works in right
 * now, or the application they sent in and are still waiting on; anything else is "not found", so a
 * public id says nothing about shops that exist but are not theirs. Pages do not authorize anything
 * with this: every API route checks permissions itself.
 */
export async function requireShopPage(publicShopId: string): Promise<ShopPage> {
    await connection()
    const user = await requireRole([Role.COMPANY])

    const shops = await loadMyShops(user.id)
    const mine = shops.find((s) => s.publicShopId === publicShopId)
    if (!mine) notFound()
    const shop = await prisma.shop.findFirst({ where: { publicShopId, deletedAt: null }, select })
    if (!shop) notFound()
    return shop
}

/** The public id of the shop to open for "my shop" links: the last one used, else the first one, else a pending application. */
export async function landingShopPublicId(userId: string): Promise<string | null> {
    const shops = await loadMyShops(userId)
    const live = shops.filter((s) => s.status === "ACTIVE")
    const chosen = pickActiveShop(live.map((s) => s.id), await readActiveShopHint())
    const found = live.find((s) => s.id === chosen) ?? shops.find((s) => s.status === "PENDING")
    return found?.publicShopId ?? null
}

/** Redirects to the dashboard of the landing shop, or to the application page when there is none. */
export async function redirectToMyShop(userId: string, section = "dashboard"): Promise<never> {
    const publicShopId = await landingShopPublicId(userId)
    redirect(publicShopId ? shopPath(publicShopId, section) : "/become-shop")
}
