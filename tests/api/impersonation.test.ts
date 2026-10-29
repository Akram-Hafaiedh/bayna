// tests/api/impersonation.test.ts
// "View as": starting and ending a read-only view, who may be viewed, and that nothing can be written meanwhile.
// Run: npm run test:api
import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest"
import { POST as start } from "@/app/api/admin/impersonation/start/route"
import { POST as end } from "@/app/api/admin/impersonation/end/route"
import { requireShop } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"
import { READ_ONLY_MESSAGE } from "@/lib/impersonation"
import { resolveImpersonation } from "@/lib/impersonation-session"
import { cleanUp, createStaff, createTarget, demo, prisma, signInAs, signOut } from "./helpers"

const PASSWORD = "demo1234"
const made: string[] = []

beforeEach(() => prisma.impersonationSession.deleteMany({}))
afterEach(() => signOut())
afterAll(async () => {
    await prisma.impersonationSession.deleteMany({})
    await cleanUp()
})

async function person(label = "viewed") {
    const t = await createTarget(label)
    made.push(t.id)
    const { publicUserId } = await prisma.user.findUniqueOrThrow({ where: { id: t.id }, select: { publicUserId: true } })
    return { ...t, publicUserId }
}

/** The route is called by hand here, because the cookie is in the response headers. */
async function begin(body: unknown) {
    const res = await start(new Request("http://localhost/api/admin/impersonation/start", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }))
    return { status: res.status, json: (await res.json()) as Record<string, unknown>, cookie: res.headers.get("set-cookie") ?? "" }
}
const reason = "Customer says the orders page is empty"

describe("starting a view", () => {
    test("needs a signed-in person with the permission", async () => {
        const t = await person()
        signOut()
        expect((await begin({ userId: t.publicUserId, reason, password: PASSWORD })).status).toBe(401)
        await signInAs(demo("client"))
        expect((await begin({ userId: t.publicUserId, reason, password: PASSWORD })).status).toBe(403)
        expect(await prisma.impersonationSession.count()).toBe(0)
    })

    test("needs a reason and the right password", async () => {
        const t = await person()
        await signInAs(demo("support"))
        expect((await begin({ userId: t.publicUserId, password: PASSWORD })).status).toBe(400)
        expect((await begin({ userId: t.publicUserId, reason, password: "wrong-one" })).status).toBe(400)
        expect((await begin({ userId: "nobody", reason, password: PASSWORD })).status).toBe(404)
        expect(await prisma.impersonationSession.count()).toBe(0)
    })

    test("refuses yourself, staff and an account that is not active", async () => {
        const support = await signInAs(demo("support"))
        const me = await prisma.user.findUniqueOrThrow({ where: { id: support.id }, select: { publicUserId: true } })
        expect((await begin({ userId: me.publicUserId, reason, password: PASSWORD })).status).toBe(400)

        const staff = await createStaff("Support agent", "colleague")
        made.push(staff.id)
        const colleague = await prisma.user.findUniqueOrThrow({ where: { id: staff.id }, select: { publicUserId: true } })
        expect((await begin({ userId: colleague.publicUserId, reason, password: PASSWORD })).status).toBe(400)

        const suspended = await person("suspended")
        await prisma.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } })
        expect((await begin({ userId: suspended.publicUserId, reason, password: PASSWORD })).status).toBe(400)
        expect(await prisma.impersonationSession.count()).toBe(0)
    })

    test("opens a read-only view, tells the person and writes it in the log", async () => {
        const t = await person()
        const support = await signInAs(demo("support"))

        const res = await begin({ userId: t.publicUserId, reason, password: PASSWORD })
        expect(res.status).toBe(200)
        expect(res.json.redirect).toBe("/dashboard")
        expect(res.cookie).toContain("bayna-view-as=ro.CLIENT")

        const row = await prisma.impersonationSession.findFirstOrThrow({ where: { targetUserId: t.id } })
        expect(row).toMatchObject({ adminId: support.id, mode: "READ_ONLY", reason, endedAt: null })
        expect(row.expiresAt.getTime() - row.startedAt.getTime()).toBe(30 * 60_000)

        expect(await prisma.notification.count({ where: { userId: t.id, type: "account.support.viewed" } })).toBe(1)

        const log = await prisma.activityLog.findFirstOrThrow({ where: { action: "IMPERSONATION_START", entityId: t.id } })
        expect(log).toMatchObject({ actorId: support.id, onBehalfOfId: t.id, impersonationId: row.id })
        expect(log.note).toContain(reason)

        // auth.ts asks this on every session read for an admin
        const viewing = await resolveImpersonation(support.id)
        expect(viewing?.target.id).toBe(t.id)
        expect(viewing?.view).toMatchObject({ id: row.id, mode: "READ_ONLY", adminId: support.id })
    })

    test("one view at a time", async () => {
        const a = await person("first")
        const b = await person("second")
        await signInAs(demo("support"))
        expect((await begin({ userId: a.publicUserId, reason, password: PASSWORD })).status).toBe(200)
        expect((await begin({ userId: b.publicUserId, reason, password: PASSWORD })).status).toBe(409)
        expect(await prisma.impersonationSession.count()).toBe(1)
    })

    test("a view past its time is not open any more", async () => {
        const t = await person()
        const support = await signInAs(demo("support"))
        await begin({ userId: t.publicUserId, reason, password: PASSWORD })
        await prisma.impersonationSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
        expect(await resolveImpersonation(support.id)).toBeNull()
        // and the admin can start a new one
        const other = await person("next")
        expect((await begin({ userId: other.publicUserId, reason, password: PASSWORD })).status).toBe(200)
    })
})

describe("ending a view", () => {
    test("closes the session, clears the cookie and writes it in the log", async () => {
        const t = await person()
        const support = await signInAs(demo("support"))
        await begin({ userId: t.publicUserId, reason, password: PASSWORD })
        const viewing = (await resolveImpersonation(support.id))!

        // what auth() returns while viewing: the viewed person, plus the view
        globalThis.__testSession = { user: { id: t.id, email: t.email, name: "Test Target", role: "CLIENT" }, impersonation: viewing.view }
        const res = await end(new Request("http://localhost/api/admin/impersonation/end", { method: "POST" }))
        expect(res.status).toBe(200)
        expect((res.headers.get("set-cookie") ?? "").toLowerCase()).toContain("max-age=0")

        const row = await prisma.impersonationSession.findUniqueOrThrow({ where: { id: viewing.view.id } })
        expect(row.endedAt).not.toBeNull()
        expect(row.endedBy).toBe("ADMIN")
        expect(await resolveImpersonation(support.id)).toBeNull()
        const log = await prisma.activityLog.findFirstOrThrow({ where: { action: "IMPERSONATION_END", entityId: t.id } })
        expect(log).toMatchObject({ actorId: support.id, onBehalfOfId: t.id })
    })

    test("with no view open it still clears the cookie", async () => {
        await signInAs(demo("support"))
        const res = await end(new Request("http://localhost/api/admin/impersonation/end", { method: "POST" }))
        expect(res.status).toBe(200)
        expect((res.headers.get("set-cookie") ?? "").toLowerCase()).toContain("max-age=0")
    })
})

describe("while viewing", () => {
    const view = (adminId: string) => ({ id: "imp-test", mode: "READ_ONLY" as const, expiresAt: new Date(Date.now() + 60_000).toISOString(), adminId, adminName: "Support Agent", targetName: "Carthage" })

    test("a write through a guard is refused, a read is allowed and attributed to the admin", async () => {
        const owner = await signInAs("carthage@demo.bayna.test")
        const support = await prisma.user.findUniqueOrThrow({ where: { email: demo("support") }, select: { id: true } })
        globalThis.__testSession = { user: { id: owner.id, email: owner.email, name: owner.name, role: owner.role }, impersonation: view(support.id) }

        const write = await requireShop("product.listing.view", new Request("http://localhost/api/x", { method: "POST" }))
        expect(write).toMatchObject({ ok: false, status: 403, error: READ_ONLY_MESSAGE })

        const read = await requireShop("product.listing.view", new Request("http://localhost/api/x", { method: "GET" }))
        expect(read.ok).toBe(true)
        if (read.ok) {
            expect(read.actor).toMatchObject({ actorId: support.id, onBehalfOfId: owner.id, impersonationId: "imp-test", readOnly: true })
        }
    })

    test("withAudit refuses to write for a read-only actor", async () => {
        await expect(withAudit({ actorId: "a1", readOnly: true }, async () => 1)).rejects.toThrow(/read-only/)
        await expect(withAudit({ actorId: "a1" }, async () => 1)).resolves.toBe(1)
    })
})
