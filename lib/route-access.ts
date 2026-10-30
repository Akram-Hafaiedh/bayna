// lib/route-access.ts
// Which pages a signed-in person may open, by the dashboard they belong to (User.role). Pure (unit tested); proxy.ts
// asks it for every page request. It is only the first gate: pages and routes still check permissions on the server.
// The proxy cannot read the database, so it works from the role in the sign-in cookie.

export type PageRole = "ADMIN" | "COMPANY" | "CLIENT"

/** The dashboard each role lands on. */
export function homeFor(role?: string | null): string {
    if (role === "ADMIN") return "/admin/dashboard"
    if (role === "COMPANY") return "/shop"
    if (role === "CLIENT") return "/dashboard"
    return "/"
}

// roles undefined = any signed-in person
export const RULES: { prefix: string; roles?: PageRole[] }[] = [
    { prefix: "/admin", roles: ["ADMIN"] },
    { prefix: "/shop", roles: ["COMPANY"] },
    { prefix: "/business", roles: ["COMPANY"] },
    { prefix: "/dashboard", roles: ["CLIENT"] },
    { prefix: "/profile" },
    { prefix: "/become-shop" },
]

export type RouteDecision = { type: "next" } | { type: "redirect"; to: string }

/**
 * `user` is null when nobody is signed in. `viewAsRole` is the role of the account a staff member is viewing (from the
 * view-as cookie); only an ADMIN is ever routed by it.
 */
export function decideRoute(input: {
    pathname: string
    user: { id?: string | null; role?: string | null } | null | undefined
    viewAsRole?: string | null
}): RouteDecision {
    const { pathname, user } = input
    const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"))
    if (!rule) return { type: "next" }

    if (!user?.id) return { type: "redirect", to: "/login" }

    const role = user.role === "ADMIN" && input.viewAsRole ? input.viewAsRole : user.role
    if (rule.roles && !rule.roles.includes(role as PageRole)) return { type: "redirect", to: homeFor(role) }
    return { type: "next" }
}
