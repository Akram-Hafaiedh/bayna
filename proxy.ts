// proxy.ts
import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import type { Role } from "@/app/generated/prisma/enums"

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

function homeFor(role?: Role) {
    if (role === "ADMIN") return "/admin/dashboard"
    if (role === "PROVIDER") return "/provider/dashboard"
    if (role === "CLIENT") return "/dashboard"
    return "/"
}

// roles undefined = any logged-in user
const RULES: { prefix: string; roles?: Role[] }[] = [
    { prefix: "/admin", roles: ["ADMIN"] },
    { prefix: "/provider", roles: ["PROVIDER"] },
    { prefix: "/dashboard", roles: ["CLIENT"] },
    { prefix: "/profile" },
    { prefix: "/become-provider" },
]

export const proxy = auth((req) => {
    const { pathname } = req.nextUrl
    const rule = RULES.find(
        (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
    )
    if (!rule) return NextResponse.next()

    const user = req.auth?.user
    if (!user?.id) {
        return NextResponse.redirect(new URL("/login", req.nextUrl))
    }
    if (rule.roles && !rule.roles.includes(user.role as Role)) {
        return NextResponse.redirect(new URL(homeFor(user.role as Role), req.nextUrl))
    }
    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
}