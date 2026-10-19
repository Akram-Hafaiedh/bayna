// lib/access/active-business-cookie.ts
// Reads the "active business" hint. Server only. Never trusted: pickActiveBusiness() checks it
// against the businesses the person really belongs to.
import { cookies } from "next/headers"
import { ACTIVE_BUSINESS_COOKIE } from "./active-business"

export async function readActiveBusinessHint(): Promise<string | null> {
    try {
        return (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value ?? null
    } catch {
        return null // not in a request (scripts, tests)
    }
}
