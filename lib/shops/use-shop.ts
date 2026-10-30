"use client"
// lib/shops/use-shop.ts
// For client components on the shop pages: the address of a page of the shop you are on.
import { useParams } from "next/navigation"
import { lastShopPath, shopPath } from "@/lib/shops/shop-paths"

/** shopHref("team") is "/shop/<this shop>/team". Outside a shop page it points at the landing instead. */
export function useShopHref(): (section?: string) => string {
    const params = useParams<{ publicShopId?: string }>()
    const publicShopId = typeof params?.publicShopId === "string" ? params.publicShopId : null
    return (section = "dashboard") => (publicShopId ? shopPath(publicShopId, section) : lastShopPath(section))
}
