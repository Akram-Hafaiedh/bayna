// auth.ts
import NextAuth, { CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { SignInRefused, authorizeCredentials } from "@/lib/auth/sign-in"
import { shouldTouchActivity } from "@/lib/users/session-activity"
import { endViewsOnSignOut, resolveImpersonation } from "@/lib/admin/impersonation-session"
import type { Role } from "@/app/generated/prisma/enums"

// A sign-in refused because of the account's status. The `code` tells the login page which message to show.
class AccountBlocked extends CredentialsSignin {
    constructor(code: string) {
        super()
        this.code = code
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    },
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                // The rules live in lib/sign-in.ts (tested there); here a refusal becomes the code the login page reads
                try {
                    return await authorizeCredentials(credentials, request)
                } catch (e) {
                    if (e instanceof SignInRefused) throw new AccountBlocked(e.code)
                    throw e
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            // Fresh sign-in
            if (user) {
                token.id = user.id
                token.role = (user as { role?: Role }).role

                try {
                    const loginSession = await prisma.loginSession.create({
                        data: {
                            userId: user.id as string,
                            deviceLabel: "Web browser",
                        },
                    })
                    token.loginSessionId = loginSession.id
                } catch {
                    // don't block login if LoginSession fails
                }

                // The audit trigger ignores this column, so the write leaves no log row
                await prisma.user
                    .update({ where: { id: user.id as string }, data: { lastLoginAt: new Date() } })
                    .catch(() => { })
            }

            // ALWAYS refresh role and name from the DB (a role change or a profile edit shows without signing in again)
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { role: true, name: true, status: true },
                    })
                    // An account the platform team suspended is signed out on its next request
                    if (dbUser && dbUser.status !== "ACTIVE") {
                        return { ...token, id: undefined, role: undefined, loginSessionId: undefined }
                    }
                    if (dbUser?.role) {
                        token.role = dbUser.role
                    }
                    // The name shown in the menu follows the profile page (the token keeps the one from sign-in otherwise)
                    if (dbUser) token.name = dbUser.name
                } catch {
                    // ignore
                }
            }

            // Validate login session if present
            if (token.loginSessionId) {
                try {
                    const loginSession = await prisma.loginSession.findUnique({
                        where: { id: token.loginSessionId as string },
                    })

                    if (!loginSession || loginSession.revokedAt) {
                        return {
                            ...token,
                            id: undefined,
                            role: undefined,
                            loginSessionId: undefined,
                        }
                    }

                    // At most once per interval: this callback runs on every auth() call
                    if (trigger !== "signIn" && shouldTouchActivity(loginSession.lastActiveAt, Date.now())) {
                        await prisma.loginSession
                            .update({
                                where: { id: loginSession.id },
                                data: { lastActiveAt: new Date() },
                            })
                            .catch(() => { })
                    }
                } catch {
                    // ignore
                }
            }

            return token
        },
        async session({ session, token }) {
            if (session.user) {
                if (!token.id) {
                    return {
                        ...session,
                        user: {
                            ...session.user,
                            id: "",
                            role: undefined as unknown as Role,
                        },
                    }
                }
                session.user.id = token.id as string
                session.user.role = token.role as Role
                    ; (session as { loginSessionId?: string }).loginSessionId =
                        token.loginSessionId as string

                // "View as": while a platform staff member has an open session the page, the guards and the
                // queries see the viewed person. The token and the real login stay the admin's, so Exit always
                // works. Only ADMIN accounts can have a session, so everyone else costs no extra query.
                if (token.role === "ADMIN") {
                    try {
                        const viewing = await resolveImpersonation(token.id as string)
                        if (viewing) {
                            session.user.id = viewing.target.id
                            session.user.role = viewing.target.role as Role
                            session.user.name = viewing.target.name
                            session.user.email = viewing.target.email
                            session.impersonation = viewing.view
                        }
                    } catch {
                        // if the lookup fails the person simply stays themselves
                    }
                }
            }
            return session
        },
    },
    events: {
        async signOut(message) {
            const token = "token" in message ? message.token : null
            // Signing out ends a "view as" the person left open, so it cannot come back at the next sign-in
            if (token?.role === "ADMIN" && token.id) {
                await endViewsOnSignOut(token.id as string).catch(() => { })
            }
            if (token?.loginSessionId) {
                await prisma.loginSession
                    .update({
                        where: { id: token.loginSessionId as string },
                        data: { revokedAt: new Date() },
                    })
                    .catch(() => { })
            }
        },
    },
})