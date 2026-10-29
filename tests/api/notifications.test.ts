// tests/api/notifications.test.ts
// A person's own notifications: listing them and marking them read. Nobody reaches anybody else's.
// Run: npm run test:api
import { afterAll, afterEach, describe, expect, test } from "vitest"
import { GET as list } from "@/app/api/notifications/route"
import { POST as markRead } from "@/app/api/notifications/read/route"
import { buildNotifications, notifications } from "@/lib/notifications"
import { call, cleanUp, createTarget, prisma, signInAs, signOut } from "./helpers"

const made: string[] = []

afterEach(() => signOut())
afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: made } } })
    await cleanUp()
})

async function personWith(count: number) {
    const u = await createTarget("notified")
    made.push(u.id)
    for (let i = 0; i < count; i++) {
        await prisma.notification.create({ data: { userId: u.id, type: "test", title: `Note ${i}`, createdAt: new Date(Date.now() - i * 1000) } })
    }
    return u
}

describe("listing", () => {
    test("needs a signed-in person", async () => {
        signOut()
        expect((await call(list, { method: "GET" })).status).toBe(401)
    })

    test("returns only the person's own, newest first, with the unread count", async () => {
        const me = await personWith(3)
        await personWith(2) // somebody else's
        await signInAs(me.email)
        const res = await call(list, { method: "GET" })
        expect(res.status).toBe(200)
        const items = res.json?.items as { title: string }[]
        expect(items.map((i) => i.title)).toEqual(["Note 0", "Note 1", "Note 2"])
        expect(res.json?.unreadCount).toBe(3)
    })

    test("the limit is respected and capped at 50", async () => {
        const me = await personWith(5)
        await signInAs(me.email)
        const two = await call(list, { method: "GET", url: "http://localhost/api/notifications?limit=2" })
        expect((two.json?.items as unknown[]).length).toBe(2)
        const huge = await call(list, { method: "GET", url: "http://localhost/api/notifications?limit=9999" })
        expect((huge.json?.items as unknown[]).length).toBe(5)
        // nonsense falls back to the default
        const odd = await call(list, { method: "GET", url: "http://localhost/api/notifications?limit=abc" })
        expect(odd.status).toBe(200)
    })
})

describe("marking as read", () => {
    test("needs a signed-in person and something to mark", async () => {
        signOut()
        expect((await call(markRead, { body: { all: true } })).status).toBe(401)
        const me = await personWith(1)
        await signInAs(me.email)
        expect((await call(markRead, { body: {} })).status).toBe(400)
        expect((await call(markRead, { body: { ids: [] } })).status).toBe(400)
    })

    test("marks the ids sent, and only the person's own", async () => {
        const me = await personWith(3)
        const other = await personWith(1)
        const mine = await prisma.notification.findMany({ where: { userId: me.id }, select: { id: true } })
        const theirs = await prisma.notification.findFirstOrThrow({ where: { userId: other.id }, select: { id: true } })

        await signInAs(me.email)
        const res = await call(markRead, { body: { ids: [mine[0].id, theirs.id] } })
        expect(res.status).toBe(200)
        expect(res.json).toMatchObject({ marked: 1, unreadCount: 2 })
        expect((await prisma.notification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull()
    })

    test("all: true marks every unread one", async () => {
        const me = await personWith(4)
        await signInAs(me.email)
        const res = await call(markRead, { body: { all: true } })
        expect(res.json).toMatchObject({ marked: 4, unreadCount: 0 })
    })
})

describe("the links in notifications", () => {
    // A notification links to a page inside the app; anything else is dropped (see buildNotifications)
    test("every ready-made message links to a path inside the app", () => {
        const messages = [
            notifications.applicationApproved({ shop: "abc" }),
            notifications.applicationRejected(),
            notifications.profileReviewed({ shop: "abc" }),
            notifications.teamJoined({ who: "Sami", where: "Sfax BTP", role: "Manager" }),
            notifications.teamRoleChanged({ where: "Sfax BTP", role: "Viewer" }),
            notifications.teamSuspended({ where: "Sfax BTP" }),
            notifications.teamReinstated({ where: "Sfax BTP" }),
            notifications.teamRemoved({ where: "Sfax BTP" }),
            notifications.accountDeletionCancelled(),
            notifications.supportViewedAccount(),
        ]
        for (const m of messages) {
            const [row] = buildNotifications("u1", m)
            expect(row.href, m.type).toMatch(/^\/(?!\/)/)
        }
    })

    test("a link to another site is dropped", () => {
        const [row] = buildNotifications("u1", { type: "t", title: "x", href: "https://evil.example/phish" })
        expect(row.href).toBeNull()
    })
})
