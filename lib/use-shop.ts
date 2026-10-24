"use client"
// lib/use-shop.ts
// For client components on the shop pages: the address of a page of the shop you are on.
import { useParams } from "next/navigation"
import { lastShopPath, shopPath } from "@/lib/shop-paths"

/** shopHref("team") is "/shop/<this shop>/team". Outside a shop page it points at the landing instead. */
export function useShopHref(): (section?: string) => string {
    const params = useParams<{ publicId?: string }>()
    const publicId = typeof params?.publicId === "string" ? params.publicId : null
    return (section = "dashboard") => (publicId ? shopPath(publicId, section) : lastShopPath(section))
}
