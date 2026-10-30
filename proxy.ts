// proxy.ts
import NextAuth from "next-auth"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import type { Role } from "@/app/generated/prisma/enums"
import { decideRoute } from "@/lib/auth/route-access"
import { VIEW_AS_COOKIE, parseViewAsCookie, viewAsBlock } from "@/lib/admin/impersonation"

// Lightweight instance: same AUTH_SECRET and JWT cookie as auth.ts,
// but no adapter, no providers and no DB callbacks.
const { auth } = NextAuth({
    providers: [],
    session: { strategy: "jwt" },
    callbacks: {
        // Copy what your full jwt callback already put on the token
        session({ session, token }) {
            if (session.user) {
                session.user.id = (token.id as string | undefined) ?? ""
                session.user.role = token.role as Role
            }
            return session
        },
    },
})

const routePages = auth((req) => {
    // "View as": an admin viewing another account is routed as that account (the cookie says which role). The cookie
    // only ever restricts; the pages and the API still check the real session on the server.
    const decision = decideRoute({
        pathname: req.nextUrl.pathname,
        user: req.auth?.user,
        viewAsRole: parseViewAsCookie(req.cookies.get(VIEW_AS_COOKIE)?.value)?.role,
    })
    if (decision.type === "redirect") return NextResponse.redirect(new URL(decision.to, req.nextUrl))
    return NextResponse.next()
})

export async function proxy(req: NextRequest, event: NextFetchEvent) {
    const { pathname } = req.nextUrl

    // While a read-only "view as" session is open, only reading goes through (this covers the API and form posts)
    const blocked = viewAsBlock(req.method, pathname, parseViewAsCookie(req.cookies.get(VIEW_AS_COOKIE)?.value))
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    // The API does its own checks (lib/access/guard.ts); the page rules below are for pages only
    if (pathname.startsWith("/api")) return NextResponse.next()

    return (routePages as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response>)(req, event)
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
}
