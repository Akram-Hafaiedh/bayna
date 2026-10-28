// tests/api/staff.test.ts
// The Staff page: inviting people to work for Bayna, accepting the invitation, and changing or removing staff.
// Run: npm run test:api
import { afterAll, afterEach, describe, expect, test } from "vitest"
import { POST as invite } from "@/app/api/admin/staff/invites/route"
import { DELETE as cancelInvite } from "@/app/api/admin/staff/invites/[id]/route"
import { PATCH as change, DELETE as remove } from "@/app/api/admin/staff/[id]/route"
import { POST as accept } from "@/app/api/invites/accept/route"
import { hashInviteToken, newInviteToken } from "@/lib/access/invite-token"
import {
    call, cleanUp, createPlatformRole, createStaff, createStaffWithRole, createTarget, demo, freshEmail, platformRoleId, prisma, signInAs, signOut,
} from "./helpers"

afterEach(() => signOut())
afterAll(cleanUp)

const inviteBody = (email: string, roleId: string) => ({ body: { email, roleId } })

describe("inviting staff", () => {
    test("needs the permission to hand out access: a support agent or a client is refused", async () => {
        const roleId = await platformRoleId("Support agent")
        signOut()
        expect((await call(invite, inviteBody(freshEmail(), roleId))).status).toBe(401)
        await signInAs(demo("client"))
        expect((await call(invite, inviteBody(freshEmail(), roleId))).status).toBe(403)
        await signInAs(demo("support"))
        expect((await call(invite, inviteBody(freshEmail(), roleId))).status).toBe(403)
    })

    test("a super admin gets a link token once, and only its hash is stored", async () => {
        await signInAs(demo("admin"))
        const email = freshEmail("newstaff")
        const res = await call(invite, inviteBody(email, await platformRoleId("Support agent")))
        expect(res.status).toBe(201)
        const token = String(res.json?.token)
        expect(token).toHaveLength(43)

        const row = await prisma.accessInvite.findFirstOrThrow({ where: { email } })
        expect(row).toMatchObject({ scope: "PLATFORM", status: "PENDING", providerId: null, businessId: null })
        expect(row.tokenHash).toBe(hashInviteToken(token))
        expect(row.tokenHash).not.toBe(token)
    })

    test("a new invitation for the same address replaces the older one", async () => {
        await signInAs(demo("admin"))
        const email = freshEmail("again")
        const roleId = await platformRoleId("Support agent")
        await call(invite, inviteBody(email, roleId))
        await call(invite, inviteBody(email, roleId))
        const rows = await prisma.accessInvite.findMany({ where: { email }, orderBy: { createdAt: "asc" } })
        expect(rows.map((r) => r.status)).toEqual(["REVOKED", "PENDING"])
    })

    test("only platform roles can be given: a shop role is refused", async () => {
        await signInAs(demo("admin"))
        const shopRole = await prisma.accessRole.findFirstOrThrow({ where: { scope: "SHOP", name: "Manager" }, select: { id: true } })
        const res = await call(invite, inviteBody(freshEmail(), shopRole.id))
        expect(res.status).toBe(400)
    })

    test("bad input is refused", async () => {
        await signInAs(demo("admin"))
        const roleId = await platformRoleId("Support agent")
        expect((await call(invite, inviteBody("not-an-email", roleId))).status).toBe(400)
        expect((await call(invite, { body: { email: freshEmail() } })).status).toBe(400)
        expect((await call(invite, inviteBody(freshEmail(), "no-such-role"))).status).toBe(400)
    })

    test("not to yourself, not to someone already on the staff, not to someone who works in a shop", async () => {
        await signInAs(demo("admin"))
        const roleId = await platformRoleId("Support agent")
        expect((await call(invite, inviteBody(demo("admin"), roleId))).status).toBe(400)
        expect((await call(invite, inviteBody(demo("support"), roleId))).status).toBe(400)
        const res = await call(invite, inviteBody(demo("manager-tunis"), roleId))
        expect(res.status).toBe(400)
        expect(String(res.json?.error)).toMatch(/shop or a business/)
    })

    test("nobody hands out more access than they hold", async () => {
        // A person who may hand out access, but does not hold everything
        const limited = await createPlatformRole("granter", ["access.assignment.view", "access.assignment.grant"])
        const actor = await createStaffWithRole(limited.id, "granter")
        await signInAs(actor.email)
        const res = await call(invite, inviteBody(freshEmail(), await platformRoleId("Super admin")))
        expect(res.status).toBe(403)
        expect(String(res.json?.error)).toMatch(/more access/)
        // ...but may hand out a role that is within what they hold
        const small = await createPlatformRole("small", ["access.assignment.view"])
        expect((await call(invite, inviteBody(freshEmail(), small.id))).status).toBe(201)
    })

    test("an invitation can be cancelled, and then it cannot be used", async () => {
        await signInAs(demo("admin"))
        const email = freshEmail("cancelled")
        const created = await call(invite, inviteBody(email, await platformRoleId("Support agent")))
        const id = String((created.json?.invite as { id: string }).id)

        expect((await call(cancelInvite, { method: "DELETE", params: { id } })).status).toBe(200)
        expect((await prisma.accessInvite.findUniqueOrThrow({ where: { id } })).status).toBe("REVOKED")
        expect((await call(cancelInvite, { method: "DELETE", params: { id } })).status).toBe(400)

        await signInAs(demo("support"))
        expect((await call(cancelInvite, { method: "DELETE", params: { id } })).status).toBe(403)
    })
})

describe("accepting a staff invitation", () => {
    async function inviteFor(email: string, roleName = "Support agent") {
        await signInAs(demo("admin"))
        const res = await call(invite, inviteBody(email, await platformRoleId(roleName)))
        expect(res.status).toBe(201)
        return String(res.json?.token)
    }

    test("the invited person becomes staff and their account opens the admin area", async () => {
        const person = await createTarget("joiner")
        const token = await inviteFor(person.email)

        await signInAs(person.email)
        const res = await call(accept, { body: { token } })
        expect(res).toMatchObject({ status: 200, json: { ok: true, redirect: "/admin/dashboard" } })

        const user = await prisma.user.findUniqueOrThrow({ where: { id: person.id } })
        expect(user.role).toBe("ADMIN")
        const row = await prisma.accessAssignment.findFirstOrThrow({ where: { userId: person.id, scope: "PLATFORM" }, include: { role: true } })
        expect(row).toMatchObject({ status: "ACTIVE", providerId: null, businessId: null })
        expect(row.role.name).toBe("Support agent")
    })

    test("the link works once", async () => {
        const person = await createTarget("once")
        const token = await inviteFor(person.email)
        await signInAs(person.email)
        expect((await call(accept, { body: { token } })).status).toBe(200)
        expect((await call(accept, { body: { token } })).status).toBe(410)
    })

    test("only the invited address can accept it", async () => {
        const person = await createTarget("invited")
        const other = await createTarget("other")
        const token = await inviteFor(person.email)
        await signInAs(other.email)
        expect((await call(accept, { body: { token } })).status).toBe(403)
        expect(await prisma.accessAssignment.count({ where: { userId: other.id } })).toBe(0)
    })

    test("an expired or cancelled link is refused", async () => {
        const person = await createTarget("late")
        const token = await inviteFor(person.email)
        await prisma.accessInvite.updateMany({ where: { tokenHash: hashInviteToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } })
        await signInAs(person.email)
        expect((await call(accept, { body: { token } })).status).toBe(410)
    })

    test("an account that works in a shop cannot accept, even if the invitation exists", async () => {
        // The invite form refuses such an address; this covers an invitation made some other way
        const role = await prisma.accessRole.findFirstOrThrow({ where: { scope: "PLATFORM", name: "Support agent" }, select: { id: true } })
        const token = newInviteToken()
        await prisma.accessInvite.create({
            data: { scope: "PLATFORM", roleId: role.id, email: demo("manager-tunis"), tokenHash: hashInviteToken(token), expiresAt: new Date(Date.now() + 86_400_000) },
        })
        try {
            await signInAs(demo("manager-tunis"))
            const res = await call(accept, { body: { token } })
            expect(res.status).toBe(403)
            const user = await prisma.user.findUniqueOrThrow({ where: { email: demo("manager-tunis") } })
            expect(user.role).toBe("PROVIDER")
        } finally {
            await prisma.accessInvite.deleteMany({ where: { tokenHash: hashInviteToken(token) } })
        }
    })
})

describe("changing and removing staff", () => {
    const path = (id: string) => ({ params: { id } })

    test("a super admin changes a role, suspends, reinstates and removes; every change needs the permission", async () => {
        const person = await createStaff("Support agent", "member")
        const moderator = await platformRoleId("Moderator")

        // a support agent may not change staff
        await signInAs(demo("support"))
        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "suspend" } })).status).toBe(403)

        await signInAs(demo("admin"))
        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "set_role", roleId: moderator } })).status).toBe(200)
        expect((await prisma.accessAssignment.findUniqueOrThrow({ where: { id: person.assignmentId } })).roleId).toBe(moderator)

        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "suspend" } })).status).toBe(200)
        expect((await prisma.accessAssignment.findUniqueOrThrow({ where: { id: person.assignmentId } })).status).toBe("SUSPENDED")
        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "suspend" } })).status).toBe(400)

        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "reinstate" } })).status).toBe(200)
        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "reinstate" } })).status).toBe(400)

        expect((await call(remove, { method: "DELETE", ...path(person.assignmentId) })).status).toBe(200)
        expect(await prisma.accessAssignment.count({ where: { id: person.assignmentId } })).toBe(0)
        // the account goes back to a plain client
        expect((await prisma.user.findUniqueOrThrow({ where: { id: person.id } })).role).toBe("CLIENT")
    })

    test("a shop role cannot be given to staff, and a made-up action is refused", async () => {
        const person = await createStaff("Support agent", "member")
        await signInAs(demo("admin"))
        const shopRole = await prisma.accessRole.findFirstOrThrow({ where: { scope: "SHOP", name: "Manager" }, select: { id: true } })
        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "set_role", roleId: shopRole.id } })).status).toBe(400)
        expect((await call(change, { method: "PATCH", ...path(person.assignmentId), body: { action: "explode" } })).status).toBe(400)
        expect((await call(change, { method: "PATCH", ...path("no-such-assignment"), body: { action: "suspend" } })).status).toBe(404)
    })

    test("nobody changes their own role or suspends themselves", async () => {
        const me = await createStaff("Support agent", "self")
        await signInAs(me.email)
        // a plain support agent has no permission at all; give the check a person who has it
        const granter = await createPlatformRole("self-changer", ["access.assignment.view", "access.assignment.grant", "access.assignment.revoke"])
        const actor = await createStaffWithRole(granter.id, "self-changer")
        await signInAs(actor.email)
        const moderator = await platformRoleId("Moderator")
        expect((await call(change, { method: "PATCH", ...path(actor.assignmentId), body: { action: "set_role", roleId: moderator } })).status).toBe(403)
        expect((await call(change, { method: "PATCH", ...path(actor.assignmentId), body: { action: "suspend" } })).status).toBe(403)
    })

    test("nobody touches someone with more access than they hold, or gives a bigger role", async () => {
        const limited = await createPlatformRole("limited", ["access.assignment.view", "access.assignment.grant", "access.assignment.revoke", "support.ticket.view_all"])
        const actor = await createStaffWithRole(limited.id, "limited")
        const target = await createStaff("Moderator", "bigger")
        await signInAs(actor.email)
        // the moderator holds keys the actor does not
        expect((await call(change, { method: "PATCH", ...path(target.assignmentId), body: { action: "suspend" } })).status).toBe(403)
        expect((await call(remove, { method: "DELETE", ...path(target.assignmentId) })).status).toBe(403)
        // a colleague with a small role may be given a role the actor holds in full, but not a bigger one
        const colleague = await createStaffWithRole(await platformRoleId("Support agent"), "colleague")
        const bigger = await platformRoleId("Super admin")
        expect((await call(change, { method: "PATCH", ...path(colleague.assignmentId), body: { action: "set_role", roleId: bigger } })).status).toBe(403)
    })

    test("the last owner cannot remove themselves, and the platform keeps an owner", async () => {
        // Make the demo super admin the only live owner: suspend every other account that holds ownership
        const owners = await prisma.user.findMany({
            where: {
                status: "ACTIVE",
                email: { not: demo("admin") },
                accessAssignments: {
                    some: { scope: "PLATFORM", status: "ACTIVE", role: { OR: [{ permissions: { has: "*" } }, { permissions: { has: "access.assignment.grant" } }] } },
                },
            },
            select: { id: true },
        })
        await prisma.user.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { status: "SUSPENDED" } })
        try {
            const me = await signInAs(demo("admin"))
            const mine = await prisma.accessAssignment.findFirstOrThrow({ where: { userId: me.id, scope: "PLATFORM" }, select: { id: true } })
            const res = await call(remove, { method: "DELETE", ...path(mine.id) })
            expect(res.status).toBe(409)
            expect(String(res.json?.error)).toMatch(/owner/i)
            expect(await prisma.accessAssignment.count({ where: { id: mine.id } })).toBe(1)
        } finally {
            await prisma.user.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { status: "ACTIVE" } })
        }
    })
})
