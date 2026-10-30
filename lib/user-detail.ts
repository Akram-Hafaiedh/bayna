// lib/user-detail.ts
// Small pure helpers for the admin user detail page (unit tested). The page reads with lib/admin-user-detail.ts.

export const userDetailPath = (publicUserId: string) => `/admin/users/${publicUserId}`

export type SessionLike = { revokedAt: Date | null }

/** "Open" until the person signed out or an admin ended it. */
export const sessionState = (s: SessionLike): "open" | "ended" => (s.revokedAt ? "ended" : "open")

export type AssignmentLike = {
    scope: "PLATFORM" | "BUSINESS" | "SHOP"
    status: string
    expiresAt: Date | null
    shop: { name: string } | null
    business: { name: string } | null
}

/** Where a role applies: the shop, the business, or the platform. */
export function assignmentPlace(a: Pick<AssignmentLike, "scope" | "shop" | "business">): string {
    if (a.scope === "PLATFORM") return "Bayna platform"
    if (a.scope === "BUSINESS") return a.business?.name ?? "A business"
    return a.shop?.name ?? "A shop"
}

/** "Active", "Suspended", "Invited", or "Expired" for a role past its end date. */
export function assignmentState(a: Pick<AssignmentLike, "status" | "expiresAt">, now: Date = new Date()): string {
    if (a.expiresAt && a.expiresAt.getTime() <= now.getTime()) return "Expired"
    return a.status.charAt(0) + a.status.slice(1).toLowerCase()
}
