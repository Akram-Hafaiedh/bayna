// lib/access/active-cookie.ts
// Reads the "active shop" hint. Server only. The value is never trusted: pickActiveShop() checks it
// against the person's live shop assignments.
import { cookies } from "next/headers"
import { ACTIVE_SHOP_COOKIE } from "./active-shop"

export async function readActiveShopHint(): Promise<string | null> {
    try {
        return (await cookies()).get(ACTIVE_SHOP_COOKIE)?.value ?? null
    } catch {
        return null // not in a request (scripts, tests)
    }
}
