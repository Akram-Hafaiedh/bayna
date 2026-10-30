// tests/api/team.test.ts
// The team routes of a shop: inviting, cancelling an invitation, changing, suspending and removing a member.
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { POST as invite } from "@/app/api/team/invites/route"
import { DELETE as cancelInvite } from "@/app/api/team/invites/[id]/route"
import { PATCH as changeMember, DELETE as removeMember } from "@/app/api/team/members/[id]/route"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { call, cleanUp, createTarget, demo, freshEmail, prisma, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let tunis = { id: "", viewerRole: "", managerRole: "" }
let marsa = { id: "", viewerRole: "" }
const made: string[] = []

beforeAll(async () => {
    const shop = async (name: string) => prisma.shop.findFirstOrThrow({ where: { name }, select: { id: true } })
    const role = async (shopId: string, name: string) => (await prisma.accessRole.findFirstOrThrow({ where: { shopId, name }, select: { id: true } })).id
    const t = await shop(SHOP_NAMES.tunis)
    const m = await shop(SHOP_NAMES.marsa)
    tunis = { id: t.id, viewerRole: await role(t.id, "Viewer"), managerRole: await role(t.id, "Manager") }
    marsa = { id: m.id, viewerRole: await role(m.id, "Viewer") }
})

afterEach(() => signOut())
afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: made } } })
    await cleanUp()
})

/** A new person who works in the Tunis shop as a Viewer, to act on. */
async function viewerInTunis() {
    const u = await createTarget("member")
    made.push(u.id)
    const a = await prisma.accessAssignment.create({
        data: { userId: u.id, roleId: tunis.viewerRole, scope: "SHOP", shopId: tunis.id, status: "ACTIVE" },
        select: { id: true },
    })
    return { ...u, assignmentId: a.id }
}

describe("inviting", () => {
    test("needs a signed-in person who may invite, in that shop", async () => {
        const body = { scope: "SHOP", email: freshEmail("new"), roleId: tunis.viewerRole, targetId: tunis.id }
        signOut()
        expect((await call(invite, { body })).status).toBe(401)

        await signInAs(demo("client"))
        expect((await call(invite, { body })).status).toBe(403)

        // a viewer reads, nothing more
        await signInAs(demo("viewer"))
        expect((await call(invite, { body })).status).toBe(403)

        // a manager of another shop does not work in this one
        await signInAs(demo("manager-marsa"))
        expect((await call(invite, { body })).status).toBe(403)
        expect(await prisma.accessInvite.count({ where: { email: body.email } })).toBe(0)
    })

    test("a bad request is a 400", async () => {
        await signInAs(OWNER)
        expect((await call(invite, { body: {} })).status).toBe(400)
        expect((await call(invite, { body: { scope: "SHOP", email: "not-an-email", roleId: tunis.viewerRole } })).status).toBe(400)
        expect((await call(invite, { body: { scope: "SHOP", email: freshEmail("x") } })).status).toBe(400)
    })

    test("an owner invites someone: the link is shown once and only its hash is kept", async () => {
        await signInAs(OWNER)
        const email = freshEmail("invitee")
        const res = await call(invite, { body: { scope: "SHOP", email, roleId: tunis.viewerRole, targetId: tunis.id } })
        expect(res.status).toBe(201)
        const token = res.json?.token as string
        expect(token).toBeTruthy()

        const row = await prisma.accessInvite.findFirstOrThrow({ where: { email } })
        expect(row).toMatchObject({ status: "PENDING", scope: "SHOP", shopId: tunis.id, roleId: tunis.viewerRole })
        expect(row.tokenHash).not.toBe(token)
        expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now())

        const log = await prisma.activityLog.findFirst({ where: { action: "TEAM_INVITED", entityId: row.id } })
        expect(log).toMatchObject({ shopId: tunis.id })
    })

    test("a new link for the same person replaces the old one", async () => {
        await signInAs(OWNER)
        const email = freshEmail("again")
        const body = { scope: "SHOP", email, roleId: tunis.viewerRole, targetId: tunis.id }
        expect((await call(invite, { body })).status).toBe(201)
        expect((await call(invite, { body })).status).toBe(201)
        const rows = await prisma.accessInvite.findMany({ where: { email } })
        expect(rows.filter((r) => r.status === "PENDING")).toHaveLength(1)
        expect(rows.filter((r) => r.status === "REVOKED")).toHaveLength(1)
    })

    test("not yourself, and not someone who already works there", async () => {
        await signInAs(OWNER)
        expect((await call(invite, { body: { scope: "SHOP", email: OWNER, roleId: tunis.viewerRole, targetId: tunis.id } })).status).toBe(400)
        expect((await call(invite, { body: { scope: "SHOP", email: demo("manager-tunis"), roleId: tunis.viewerRole, targetId: tunis.id } })).status).toBe(400)
    })

    test("the role must belong to that shop or its business", async () => {
        await signInAs(OWNER)
        const res = await call(invite, { body: { scope: "SHOP", email: freshEmail("x"), roleId: "does-not-exist", targetId: tunis.id } })
        expect(res.status).toBe(400)
        // a role of the La Marsa shop is not usable in the Tunis shop
        const other = await call(invite, { body: { scope: "SHOP", email: freshEmail("x"), roleId: marsa.viewerRole, targetId: tunis.id } })
        expect(other.status).toBe(400)
    })
})

describe("cancelling an invitation", () => {
    async function pending() {
        await signInAs(OWNER)
        const email = freshEmail("cancel")
        await call(invite, { body: { scope: "SHOP", email, roleId: tunis.viewerRole, targetId: tunis.id } })
        return prisma.accessInvite.findFirstOrThrow({ where: { email }, select: { id: true } })
    }

    test("the link stops working and the log says so", async () => {
        const inv = await pending()
        const res = await call(cancelInvite, { method: "DELETE", params: { id: inv.id } })
        expect(res.status).toBe(200)
        expect((await prisma.accessInvite.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("REVOKED")
        expect(await prisma.activityLog.count({ where: { action: "TEAM_INVITE_CANCELLED", entityId: inv.id } })).toBe(1)
        // twice is refused
        expect((await call(cancelInvite, { method: "DELETE", params: { id: inv.id } })).status).toBe(400)
    })

    test("people without the permission cannot, and an unknown id is a 404", async () => {
        const inv = await pending()
        signOut()
        expect((await call(cancelInvite, { method: "DELETE", params: { id: inv.id } })).status).toBe(401)
        await signInAs(demo("viewer"))
        expect((await call(cancelInvite, { method: "DELETE", params: { id: inv.id } })).status).toBe(403)
        await signInAs(OWNER)
        expect((await call(cancelInvite, { method: "DELETE", params: { id: "nope" } })).status).toBe(404)
        expect((await prisma.accessInvite.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PENDING")
    })
})

describe("changing a member", () => {
    test("needs the permission, in that shop", async () => {
        const m = await viewerInTunis()
        const body = { action: "suspend" }
        signOut()
        expect((await call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body })).status).toBe(401)
        await signInAs(demo("viewer"))
        expect((await call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body })).status).toBe(403)
        await signInAs(demo("manager-marsa"))
        expect((await call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body })).status).toBe(403)
        expect((await prisma.accessAssignment.findUniqueOrThrow({ where: { id: m.assignmentId } })).status).toBe("ACTIVE")
    })

    test("an unknown person is a 404 and a bad action is a 400", async () => {
        const m = await viewerInTunis()
        await signInAs(OWNER)
        expect((await call(changeMember, { method: "PATCH", params: { id: "nope" }, body: { action: "suspend" } })).status).toBe(404)
        expect((await call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body: { action: "explode" } })).status).toBe(400)
        expect((await call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body: { action: "set_role", roleId: "nope" } })).status).toBe(400)
    })

    test("an owner changes the role: it is saved, logged and the person is told", async () => {
        const m = await viewerInTunis()
        await signInAs(OWNER)
        const res = await call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body: { action: "set_role", roleId: tunis.managerRole } })
        expect(res.status).toBe(200)
        expect((await prisma.accessAssignment.findUniqueOrThrow({ where: { id: m.assignmentId } })).roleId).toBe(tunis.managerRole)
        expect(await prisma.activityLog.count({ where: { action: "TEAM_ROLE_CHANGED", entityId: m.assignmentId } })).toBe(1)
        expect(await prisma.notification.count({ where: { userId: m.id, type: "team.member.role_changed" } })).toBe(1)
    })

    test("suspending and reinstating, each only from the right state", async () => {
        const m = await viewerInTunis()
        await signInAs(OWNER)
        const patch = (action: string) => call(changeMember, { method: "PATCH", params: { id: m.assignmentId }, body: { action } })
        const status = async () => (await prisma.accessAssignment.findUniqueOrThrow({ where: { id: m.assignmentId } })).status

        expect((await patch("reinstate")).status).toBe(400) // not suspended yet
        expect((await patch("suspend")).status).toBe(200)
        expect(await status()).toBe("SUSPENDED")
        expect((await patch("suspend")).status).toBe(400) // already
        expect(await prisma.notification.count({ where: { userId: m.id, type: "team.member.suspended" } })).toBe(1)
        expect((await patch("reinstate")).status).toBe(200)
        expect(await status()).toBe("ACTIVE")
        expect(await prisma.notification.count({ where: { userId: m.id, type: "team.member.reinstated" } })).toBe(1)
    })

    test("removing a person deletes the assignment, logs it and tells them", async () => {
        const m = await viewerInTunis()
        await signInAs(OWNER)
        const res = await call(removeMember, { method: "DELETE", params: { id: m.assignmentId } })
        expect(res.status).toBe(200)
        expect(await prisma.accessAssignment.count({ where: { id: m.assignmentId } })).toBe(0)
        expect(await prisma.activityLog.count({ where: { action: "TEAM_REMOVED", entityId: m.assignmentId } })).toBe(1)
        expect(await prisma.notification.count({ where: { userId: m.id, type: "team.member.removed" } })).toBe(1)
    })

    test("nobody changes their own role or access", async () => {
        await signInAs(OWNER)
        const own = await prisma.accessAssignment.findFirstOrThrow({ where: { user: { email: OWNER }, scope: "BUSINESS" }, select: { id: true } })
        const res = await call(changeMember, { method: "PATCH", params: { id: own.id }, body: { action: "suspend" } })
        expect(res.status).toBe(403)
    })

    test("a business never loses its last owner", async () => {
        await signInAs(OWNER)
        const own = await prisma.accessAssignment.findFirstOrThrow({ where: { user: { email: OWNER }, scope: "BUSINESS" }, select: { id: true } })
        const res = await call(removeMember, { method: "DELETE", params: { id: own.id } })
        expect(res.status).toBe(409)
        expect(await prisma.accessAssignment.count({ where: { id: own.id } })).toBe(1)
    })
})
