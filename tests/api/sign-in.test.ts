// tests/api/sign-in.test.ts
// Signing in with an email and a password (lib/auth/sign-in.ts, which auth.ts calls): who gets in, who is refused and why,
// and the limit on failed tries.
// Run: npm run test:api
import { afterAll, describe, expect, test } from "vitest"
import bcrypt from "bcryptjs"
import { SignInRefused, authorizeCredentials } from "@/lib/auth/sign-in"
import { RATE_LIMITED_CODE } from "@/lib/rate-limit"
import { cleanUp, freshEmail, freshIp, prisma } from "./helpers"

const PASSWORD = "right-password-1"
const made: string[] = []

afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: made } } })
    await cleanUp()
})

async function person(data: { status?: "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING_DELETION"; password?: string | null; deletionRequestedAt?: Date } = {}) {
    const user = await prisma.user.create({
        data: {
            email: freshEmail("signin"),
            name: "Sign In",
            role: "CLIENT",
            password: data.password === undefined ? await bcrypt.hash(PASSWORD, 4) : data.password,
            status: data.status ?? "ACTIVE",
            deletionRequestedAt: data.deletionRequestedAt,
        },
        select: { id: true, email: true },
    })
    made.push(user.id)
    return user
}

/** One try from a fresh address, so a counter kept per address never leaks from one test to the next. */
const tryIn = (email: unknown, password: unknown, ip: string = freshIp()) =>
    authorizeCredentials(
        { email, password },
        new Request("http://localhost/api/auth/callback/credentials", { method: "POST", headers: { "x-forwarded-for": ip } })
    )

const refusedWith = async (p: Promise<unknown>) => {
    try {
        await p
    } catch (e) {
        return e instanceof SignInRefused ? e.code : "other error"
    }
    return null
}

describe("a normal sign-in", () => {
    test("the right password lets an active account in", async () => {
        const u = await person()
        expect(await tryIn(u.email, PASSWORD)).toMatchObject({ id: u.id, email: u.email, role: "CLIENT" })
    })

    test("the email may be written in capitals or with spaces around it", async () => {
        const u = await person()
        expect(await tryIn(`  ${u.email.toUpperCase()}  `, PASSWORD)).toMatchObject({ id: u.id })
    })

    test("a wrong password, an unknown email and an account without a password all give the same answer", async () => {
        const u = await person()
        const noPassword = await person({ password: null })
        expect(await tryIn(u.email, "wrong-password")).toBeNull()
        expect(await tryIn(freshEmail("nobody"), PASSWORD)).toBeNull()
        expect(await tryIn(noPassword.email, PASSWORD)).toBeNull()
    })

    test("missing fields give null", async () => {
        expect(await tryIn("", PASSWORD)).toBeNull()
        expect(await tryIn("a@b.test", "")).toBeNull()
        expect(await tryIn(undefined, undefined)).toBeNull()
    })
})

describe("accounts that cannot sign in", () => {
    test("a suspended account is told so, but only after the right password", async () => {
        const u = await person({ status: "SUSPENDED" })
        expect(await refusedWith(tryIn(u.email, PASSWORD))).toBe("account_suspended")
        // a stranger guessing gets no hint that the account exists
        expect(await tryIn(u.email, "wrong-password")).toBeNull()
    })

    test("a banned account is refused", async () => {
        const u = await person({ status: "BANNED" })
        expect(await refusedWith(tryIn(u.email, PASSWORD))).toBe("account_banned")
        expect(await tryIn(u.email, "wrong-password")).toBeNull()
    })
})

describe("an account waiting to be deleted", () => {
    test("signing in with the right password cancels the deletion", async () => {
        const u = await person({ status: "PENDING_DELETION", deletionRequestedAt: new Date() })
        expect(await tryIn(u.email, PASSWORD)).toMatchObject({ id: u.id })

        const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
        expect(after.status).toBe("ACTIVE")
        expect(after.deletionRequestedAt).toBeNull()
        expect(await prisma.notification.count({ where: { userId: u.id, type: "account.deletion.cancelled" } })).toBe(1)
        expect(await prisma.activityLog.count({ where: { entityId: u.id, action: "ACCOUNT_DELETION_CANCELLED" } })).toBe(1)
    })

    test("a wrong password changes nothing", async () => {
        const u = await person({ status: "PENDING_DELETION", deletionRequestedAt: new Date() })
        expect(await tryIn(u.email, "wrong-password")).toBeNull()
        expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("PENDING_DELETION")
    })
})

describe("the limit on failed tries", () => {
    test("after 8 wrong passwords for one email even the right one is refused", async () => {
        const u = await person()
        for (let i = 0; i < 8; i++) expect(await tryIn(u.email, "wrong-password")).toBeNull()
        // each try came from another address, so it is the per-email limit that stops this one
        expect(await refusedWith(tryIn(u.email, PASSWORD))).toBe(RATE_LIMITED_CODE)
    })

    test("good sign-ins never use up the budget", async () => {
        const u = await person()
        for (let i = 0; i < 12; i++) expect(await tryIn(u.email, PASSWORD)).toMatchObject({ id: u.id })
    })

    test("a good sign-in clears the failed tries for that email", async () => {
        const u = await person()
        for (let i = 0; i < 5; i++) await tryIn(u.email, "wrong-password")
        expect(await tryIn(u.email, PASSWORD)).toMatchObject({ id: u.id })
        for (let i = 0; i < 5; i++) await tryIn(u.email, "wrong-password")
        // 5 + 5 would be over the limit of 8 if the first five had not been cleared
        expect(await tryIn(u.email, PASSWORD)).toMatchObject({ id: u.id })
    })

    test("one address trying many accounts is stopped after 20 failures", async () => {
        const ip = freshIp()
        for (let i = 0; i < 20; i++) await tryIn(freshEmail("spray"), "wrong-password", ip)
        const u = await person()
        expect(await refusedWith(tryIn(u.email, PASSWORD, ip))).toBe(RATE_LIMITED_CODE)
        // another address is not affected
        expect(await tryIn(u.email, PASSWORD)).toMatchObject({ id: u.id })
    })
})
