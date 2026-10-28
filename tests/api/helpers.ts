// tests/api/helpers.ts
// Small tools shared by the API tests.
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { testEmail } from "@/prisma/seed/seeders/users"

export { prisma }

/** The demo account with this local part, for example asUser("admin") is admin@team.bayna.test. */
export const demo = testEmail

/** Sign in as this email (the user must exist). The next calls to auth() see them. */
export async function signInAs(email: string) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true } })
    if (!user) throw new Error(`No user ${email} in the test database. Did the seed run?`)
    globalThis.__testSession = { user }
    return user
}

export function signOut() {
    globalThis.__testSession = null
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

/**
 * Call a route handler the way Next.js does and return the status and the JSON body.
 *   const res = await call(POST, { body: { reason: "spam" }, params: { id } })
 */
export async function call(
    handler: (req: Request, ctx: never) => Promise<Response>,
    opts: { method?: string; url?: string; body?: unknown; params?: Record<string, string>; headers?: Record<string, string>; ip?: string } = {}
) {
    const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers }
    if (opts.ip) headers["x-forwarded-for"] = opts.ip
    const req = new Request(opts.url ?? "http://localhost/api/test", {
        method: opts.method ?? "POST",
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) })
    const json = await res.json().catch(() => null)
    return { status: res.status, json: json as Record<string, unknown> | null }
}

export const TEST_MAIL_DOMAIN = "api-test.invalid"

/** A new address that cannot belong to a real person, so tests never collide and are easy to clean up. */
export const freshEmail = (label = "t") => `${label}-${randomUUID().slice(0, 8)}@${TEST_MAIL_DOMAIN}`

/** A new "client address", so a rate limit counted per address never leaks from one test to the next. */
export const freshIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`

/** A plain active account with one open login session, to act on. */
export async function createTarget(label = "target") {
    const user = await prisma.user.create({
        data: { email: freshEmail(label), name: "Test Target", password: "x", role: "CLIENT" },
        select: { id: true, email: true },
    })
    await prisma.loginSession.create({ data: { userId: user.id } })
    return user
}

/** Delete everything the tests created (all addresses ending in @api-test.invalid). */
export async function cleanUp() {
    await prisma.contactMessage.deleteMany({ where: { email: { endsWith: `@${TEST_MAIL_DOMAIN}` } } })
    await prisma.passwordResetToken.deleteMany({ where: { email: { endsWith: `@${TEST_MAIL_DOMAIN}` } } })
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${TEST_MAIL_DOMAIN}` } } })
}
