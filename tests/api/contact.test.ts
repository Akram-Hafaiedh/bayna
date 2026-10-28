// tests/api/contact.test.ts
// The Contact page: the public form (POST /api/contact) and the team inbox (PATCH /api/admin/messages/[id]).
// Run: npm run test:api
import { afterAll, afterEach, describe, expect, test } from "vitest"
import { POST as send } from "@/app/api/contact/route"
import { PATCH as setStatus } from "@/app/api/admin/messages/[id]/route"
import { RATE_LIMIT } from "@/lib/contact"
import { call, cleanUp, demo, freshEmail, freshIp, prisma, signInAs, signOut } from "./helpers"

afterEach(() => signOut())
afterAll(cleanUp)

const form = (email: string, extra: Record<string, unknown> = {}) => ({
    name: "Sami Ben Ali",
    email,
    topic: "SHOP",
    message: "My shop has been waiting for approval for a week.",
    ...extra,
})

describe("POST /api/contact", () => {
    test("anyone can send a message, signed in or not, and it is stored as NEW", async () => {
        signOut()
        const email = freshEmail("visitor")
        const res = await call(send, { body: form(email), ip: freshIp() })
        expect(res.status).toBe(201)

        const row = await prisma.contactMessage.findFirstOrThrow({ where: { email } })
        expect(row).toMatchObject({ status: "NEW", topic: "SHOP", name: "Sami Ben Ali", userId: null })
    })

    test("a signed-in sender is linked to the account", async () => {
        const me = await signInAs(demo("client"))
        const email = freshEmail("member")
        expect((await call(send, { body: form(email), ip: freshIp() })).status).toBe(201)
        expect((await prisma.contactMessage.findFirstOrThrow({ where: { email } })).userId).toBe(me.id)
    })

    test("the email is tidied (trimmed, lower case)", async () => {
        const email = freshEmail("tidy")
        await call(send, { body: form(`  ${email.toUpperCase()} `), ip: freshIp() })
        expect(await prisma.contactMessage.count({ where: { email } })).toBe(1)
    })

    test("bad input is refused with a message and stores nothing", async () => {
        const email = freshEmail("bad")
        const ip = freshIp()
        for (const body of [
            form(email, { name: "" }),
            form("not-an-email"),
            form(email, { topic: "SELLING_DRUGS" }),
            form(email, { message: "short" }),
            form(email, { message: "x".repeat(2001) }),
            null,
        ]) {
            const res = await call(send, { body, ip })
            expect(res.status).toBe(400)
            expect(typeof res.json?.error).toBe("string")
        }
        expect(await prisma.contactMessage.count({ where: { email } })).toBe(0)
    })

    test("the hidden field catches robots: they are told it worked and nothing is stored", async () => {
        const email = freshEmail("robot")
        const res = await call(send, { body: form(email, { website: "http://spam.example" }), ip: freshIp() })
        expect(res.status).toBe(201)
        expect(await prisma.contactMessage.count({ where: { email } })).toBe(0)
    })

    test("one sender can only write a few times an hour", async () => {
        const email = freshEmail("flood")
        const ip = freshIp()
        for (let i = 0; i < RATE_LIMIT.perHour; i++) {
            expect((await call(send, { body: form(email), ip })).status).toBe(201)
        }
        const blocked = await call(send, { body: form(email), ip })
        expect(blocked.status).toBe(429)
        expect(await prisma.contactMessage.count({ where: { email } })).toBe(RATE_LIMIT.perHour)
    })

    test("the same address cannot get round the limit with another email", async () => {
        const ip = freshIp()
        for (let i = 0; i < RATE_LIMIT.perHour; i++) {
            await call(send, { body: form(freshEmail("rot")), ip })
        }
        expect((await call(send, { body: form(freshEmail("rot")), ip })).status).toBe(429)
    })
})

describe("PATCH /api/admin/messages/[id]", () => {
    const newMessage = () =>
        prisma.contactMessage.create({
            data: { name: "Test", email: freshEmail("inbox"), topic: "OTHER", message: "A message for the inbox tests." },
            select: { id: true },
        })

    test("needs a signed-in person with the permission", async () => {
        const m = await newMessage()
        signOut()
        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "READ" } })).status).toBe(401)
        await signInAs(demo("client"))
        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "READ" } })).status).toBe(403)
        await signInAs(demo("moderator"))
        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "READ" } })).status).toBe(403)
        expect((await prisma.contactMessage.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("NEW")
    })

    test("a support agent marks a message read, then handled (who and when are kept), then new again", async () => {
        const m = await newMessage()
        const agent = await signInAs(demo("support"))

        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "READ" } })).status).toBe(200)
        expect((await prisma.contactMessage.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("READ")

        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "HANDLED" } })).status).toBe(200)
        const handled = await prisma.contactMessage.findUniqueOrThrow({ where: { id: m.id } })
        expect(handled.status).toBe("HANDLED")
        expect(handled.handledById).toBe(agent.id)
        expect(handled.handledAt).not.toBeNull()

        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "NEW" } })).status).toBe(200)
        const reopened = await prisma.contactMessage.findUniqueOrThrow({ where: { id: m.id } })
        expect(reopened.status).toBe("NEW")
        expect(reopened.handledById).toBeNull()
        expect(reopened.handledAt).toBeNull()
    })

    test("an unknown status is refused, an unknown message is 404", async () => {
        const m = await newMessage()
        await signInAs(demo("support"))
        expect((await call(setStatus, { method: "PATCH", params: { id: m.id }, body: { status: "DELETED" } })).status).toBe(400)
        expect((await call(setStatus, { method: "PATCH", params: { id: "no-such-message" }, body: { status: "READ" } })).status).toBe(404)
    })
})
