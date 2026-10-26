// auth.ts
import NextAuth, { CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { normalizeEmail } from "@/lib/email-input"
import { signInBlockFor } from "@/lib/user-status"
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
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const email = normalizeEmail(String(credentials.email))
                // Exact match first; the case-insensitive lookup covers accounts saved before
                // emails were normalised (see scripts/normalize-emails.ts)
                const user =
                    (await prisma.user.findUnique({ where: { email } })) ??
                    (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }))

                if (!user || !user.password) {
                    return null
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                )

                if (!isValid) {
                    return null
                }

                // A suspended, banned or closing account cannot sign in. The password was right, so saying why
                // does not reveal that the email has an account.
                const blocked = signInBlockFor(user.status)
                if (blocked) throw new AccountBlocked(blocked.code)
                if (user.status !== "ACTIVE") return null

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
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

                    if (trigger !== "signIn") {
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
            }
            return session
        },
    },
    events: {
        async signOut(message) {
            const token = "token" in message ? message.token : null
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