// tests/api/admin-users.test.ts
// The admin routes that act on an account: suspend, reinstate, sign out everywhere, force password reset.
// Run: npm run test:api
import { afterAll, afterEach, describe, expect, test } from "vitest"
import { POST as suspend } from "@/app/api/admin/users/[id]/suspend/route"
import { POST as reinstate } from "@/app/api/admin/users/[id]/reinstate/route"
import { POST as revokeSessions } from "@/app/api/admin/users/[id]/revoke-sessions/route"
import { POST as resetLink } from "@/app/api/admin/users/[id]/reset-link/route"
import { POST as ban } from "@/app/api/admin/users/[id]/ban/route"
import { POST as unban } from "@/app/api/admin/users/[id]/unban/route"
import { POST as register } from "@/app/api/register/route"
import { requirePlatform } from "@/lib/access/guard"
import { hashResetToken } from "@/lib/reset-token"
import { call, cleanUp, createStaff, createTarget, demo, freshEmail, freshIp, prisma, signInAs, signOut } from "./helpers"

afterEach(() => signOut())
afterAll(cleanUp)

const openSessions = (userId: string) => prisma.loginSession.count({ where: { userId, revokedAt: null } })

describe("suspend", () => {
    test("needs a signed-in person with the permission", async () => {
        const t = await createTarget()
        signOut()
        expect((await call(suspend, { params: { id: t.id }, body: { reason: "spam" } })).status).toBe(401)

        await signInAs(demo("client"))
        expect((await call(suspend, { params: { id: t.id }, body: { reason: "spam" } })).status).toBe(403)

        // a support agent may look at accounts, not suspend them
        await signInAs(demo("support"))
        expect((await call(suspend, { params: { id: t.id }, body: { reason: "spam" } })).status).toBe(403)

        expect((await prisma.user.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ACTIVE")
    })

    test("a reason is required", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        const res = await call(suspend, { params: { id: t.id }, body: {} })
        expect(res.status).toBe(400)
        expect((await prisma.user.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ACTIVE")
    })

    test("suspends the account, keeps the reason and ends every session", async () => {
        const t = await createTarget()
        expect(await openSessions(t.id)).toBe(1)
        await signInAs(demo("admin"))

        const res = await call(suspend, { params: { id: t.id }, body: { reason: "Repeated fake listings" } })
        expect(res).toMatchObject({ status: 200, json: { status: "SUSPENDED" } })

        const after = await prisma.user.findUniqueOrThrow({ where: { id: t.id } })
        expect(after.status).toBe("SUSPENDED")
        expect(after.suspendedReason).toBe("Repeated fake listings")
        expect(await openSessions(t.id)).toBe(0)
    })

    test("only an active account can be suspended", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        await call(suspend, { params: { id: t.id }, body: { reason: "first" } })
        const again = await call(suspend, { params: { id: t.id }, body: { reason: "second" } })
        expect(again.status).toBe(400)
    })

    test("nobody can suspend their own account", async () => {
        const me = await signInAs(demo("admin"))
        const res = await call(suspend, { params: { id: me.id }, body: { reason: "oops" } })
        expect(res.status).toBe(400)
        expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).status).toBe("ACTIVE")
    })

    test("an unknown account: 404", async () => {
        await signInAs(demo("admin"))
        expect((await call(suspend, { params: { id: "no-such-user" }, body: { reason: "x" } })).status).toBe(404)
    })

    test("the last platform owner cannot be suspended", async () => {
        // An Admin (everything except access management) is allowed to suspend accounts but is not an owner.
        const adminRole = await prisma.accessRole.findFirstOrThrow({ where: { scope: "PLATFORM", name: "Admin" }, select: { id: true } })
        const actorEmail = freshEmail("plain-admin")
        const actor = await prisma.user.create({ data: { email: actorEmail, name: "Plain Admin", password: "x", role: "ADMIN" }, select: { id: true } })
        await prisma.accessAssignment.create({ data: { userId: actor.id, roleId: adminRole.id, scope: "PLATFORM", status: "ACTIVE" } })

        // Make the demo super admin the only live owner: suspend every other account that holds ownership
        const owners = await prisma.user.findMany({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                email: { not: demo("admin") },
                accessAssignments: {
                    some: {
                        scope: "PLATFORM",
                        status: "ACTIVE",
                        role: { OR: [{ permissions: { has: "*" } }, { permissions: { has: "access.assignment.grant" } }] },
                    },
                },
            },
            select: { id: true },
        })
        await prisma.user.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { status: "SUSPENDED" } })
        try {
            const theOwner = await prisma.user.findUniqueOrThrow({ where: { email: demo("admin") }, select: { id: true } })
            await signInAs(actorEmail)
            const res = await call(suspend, { params: { id: theOwner.id }, body: { reason: "test" } })
            expect(res.status).toBe(400)
            expect(String(res.json?.error)).toMatch(/owner/i)
            expect((await prisma.user.findUniqueOrThrow({ where: { id: theOwner.id } })).status).toBe("ACTIVE")
        } finally {
            await prisma.user.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { status: "ACTIVE" } })
            await prisma.accessAssignment.deleteMany({ where: { userId: actor.id } })
        }
    })
})

describe("ban", () => {
    test("needs the permission: a support agent or a client is refused", async () => {
        const t = await createTarget()
        signOut()
        expect((await call(ban, { params: { id: t.id }, body: { reason: "fraud" } })).status).toBe(401)
        await signInAs(demo("client"))
        expect((await call(ban, { params: { id: t.id }, body: { reason: "fraud" } })).status).toBe(403)
        await signInAs(demo("support"))
        expect((await call(ban, { params: { id: t.id }, body: { reason: "fraud" } })).status).toBe(403)
        expect((await prisma.user.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ACTIVE")
    })

    test("a reason is required", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        const res = await call(ban, { params: { id: t.id }, body: {} })
        expect(res.status).toBe(400)
        expect(String(res.json?.error)).toMatch(/banned/)
    })

    test("bans an active account, keeps the reason and ends every session", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        const res = await call(ban, { params: { id: t.id }, body: { reason: "Repeated fraud" } })
        expect(res).toMatchObject({ status: 200, json: { status: "BANNED" } })
        const after = await prisma.user.findUniqueOrThrow({ where: { id: t.id } })
        expect(after).toMatchObject({ status: "BANNED", suspendedReason: "Repeated fraud" })
        expect(await openSessions(t.id)).toBe(0)
    })

    test("a suspended account can be banned too, a banned one cannot be banned again", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        await call(suspend, { params: { id: t.id }, body: { reason: "first look" } })
        expect((await call(ban, { params: { id: t.id }, body: { reason: "decided" } })).status).toBe(200)
        expect((await call(ban, { params: { id: t.id }, body: { reason: "again" } })).status).toBe(400)
    })

    test("nobody bans themselves, and an unknown account is 404", async () => {
        const me = await signInAs(demo("admin"))
        expect((await call(ban, { params: { id: me.id }, body: { reason: "oops" } })).status).toBe(400)
        expect((await call(ban, { params: { id: "no-such-user" }, body: { reason: "x" } })).status).toBe(404)
    })

    test("a banned person is refused everywhere at once, even with a session cookie still in the browser", async () => {
        const staffMember = await createStaff("Support agent", "banned-staff")
        await signInAs(staffMember.email)
        expect(await requirePlatform("support.ticket.view_all")).toMatchObject({ ok: true })

        await signInAs(demo("admin"))
        await call(ban, { params: { id: staffMember.id }, body: { reason: "Left the company" } })

        await signInAs(staffMember.email)
        expect(await requirePlatform("support.ticket.view_all")).toMatchObject({ ok: false, status: 403, error: "Your account has been closed" })
    })

    test("the email stays taken: a banned person cannot register again with it", async () => {
        const t = await createTarget("banned-mail")
        await signInAs(demo("admin"))
        await call(ban, { params: { id: t.id }, body: { reason: "fraud" } })
        signOut()
        const res = await call(register, {
            ip: freshIp(),
            body: { email: t.email, password: "secret123", name: "Again", acceptTerms: true },
        })
        expect(res.status).toBe(400)
        expect(String(res.json?.error)).toMatch(/already in use/i)
    })

    test("the last platform owner cannot be banned", async () => {
        const adminRole = await prisma.accessRole.findFirstOrThrow({ where: { scope: "PLATFORM", name: "Admin" }, select: { id: true } })
        const actorEmail = freshEmail("ban-admin")
        const actor = await prisma.user.create({ data: { email: actorEmail, name: "Plain Admin", password: "x", role: "ADMIN" }, select: { id: true } })
        await prisma.accessAssignment.create({ data: { userId: actor.id, roleId: adminRole.id, scope: "PLATFORM", status: "ACTIVE" } })
        const owners = await prisma.user.findMany({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                email: { not: demo("admin") },
                accessAssignments: {
                    some: { scope: "PLATFORM", status: "ACTIVE", role: { OR: [{ permissions: { has: "*" } }, { permissions: { has: "access.assignment.grant" } }] } },
                },
            },
            select: { id: true },
        })
        await prisma.user.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { status: "SUSPENDED" } })
        try {
            const theOwner = await prisma.user.findUniqueOrThrow({ where: { email: demo("admin") }, select: { id: true } })
            await signInAs(actorEmail)
            const res = await call(ban, { params: { id: theOwner.id }, body: { reason: "test" } })
            expect(res.status).toBe(400)
            expect(String(res.json?.error)).toMatch(/owner/i)
            expect((await prisma.user.findUniqueOrThrow({ where: { id: theOwner.id } })).status).toBe("ACTIVE")
        } finally {
            await prisma.user.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { status: "ACTIVE" } })
            await prisma.accessAssignment.deleteMany({ where: { userId: actor.id } })
        }
    })
})

describe("unban", () => {
    test("lifts a ban and clears the reason; only a banned account can be unbanned", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        expect((await call(unban, { params: { id: t.id } })).status).toBe(400)
        await call(ban, { params: { id: t.id }, body: { reason: "fraud" } })

        const res = await call(unban, { params: { id: t.id } })
        expect(res).toMatchObject({ status: 200, json: { status: "ACTIVE" } })
        const after = await prisma.user.findUniqueOrThrow({ where: { id: t.id } })
        expect(after).toMatchObject({ status: "ACTIVE", suspendedReason: null })
        // the old sessions stay ended: the person signs in again
        expect(await openSessions(t.id)).toBe(0)
    })

    test("a plain reinstate does not lift a ban, and unban does not reinstate a suspension", async () => {
        const banned = await createTarget()
        const suspended = await createTarget()
        await signInAs(demo("admin"))
        await call(ban, { params: { id: banned.id }, body: { reason: "fraud" } })
        await call(suspend, { params: { id: suspended.id }, body: { reason: "look" } })
        expect((await call(reinstate, { params: { id: banned.id } })).status).toBe(400)
        expect((await call(unban, { params: { id: suspended.id } })).status).toBe(400)
    })

    test("refused without the permission", async () => {
        const t = await createTarget()
        await signInAs(demo("support"))
        expect((await call(unban, { params: { id: t.id } })).status).toBe(403)
    })
})

describe("reinstate", () => {
    test("lets a suspended account back in and clears the reason", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        await call(suspend, { params: { id: t.id }, body: { reason: "temporary" } })

        const res = await call(reinstate, { params: { id: t.id } })
        expect(res).toMatchObject({ status: 200, json: { status: "ACTIVE" } })
        const after = await prisma.user.findUniqueOrThrow({ where: { id: t.id } })
        expect(after.status).toBe("ACTIVE")
        expect(after.suspendedReason).toBeNull()
    })

    test("only a suspended account can be reinstated", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        expect((await call(reinstate, { params: { id: t.id } })).status).toBe(400)
    })

    test("refused without the permission", async () => {
        const t = await createTarget()
        await signInAs(demo("support"))
        expect((await call(reinstate, { params: { id: t.id } })).status).toBe(403)
    })
})

describe("sign out everywhere", () => {
    test("ends every open session and nothing else", async () => {
        const t = await createTarget()
        await prisma.loginSession.create({ data: { userId: t.id } })
        expect(await openSessions(t.id)).toBe(2)
        await signInAs(demo("admin"))

        const res = await call(revokeSessions, { params: { id: t.id } })
        expect(res).toMatchObject({ status: 200, json: { revoked: 2 } })
        expect(await openSessions(t.id)).toBe(0)
        expect((await prisma.user.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ACTIVE")
    })

    test("not on your own account, not without the permission", async () => {
        const me = await signInAs(demo("admin"))
        expect((await call(revokeSessions, { params: { id: me.id } })).status).toBe(400)
        const t = await createTarget()
        await signInAs(demo("support"))
        expect((await call(revokeSessions, { params: { id: t.id } })).status).toBe(403)
    })
})

describe("force password reset", () => {
    test("clears the password, ends sessions and returns a link whose token is stored only as a hash", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))

        const res = await call(resetLink, { params: { id: t.id }, url: "http://localhost/api/test" })
        expect(res.status).toBe(200)
        const url = String(res.json?.url)
        const token = new URL(url).searchParams.get("token")
        expect(token).toBeTruthy()

        const after = await prisma.user.findUniqueOrThrow({ where: { id: t.id } })
        expect(after.password).toBeNull()
        expect(after.passwordChangedAt).not.toBeNull()
        expect(await openSessions(t.id)).toBe(0)

        const rows = await prisma.passwordResetToken.findMany({ where: { email: t.email } })
        expect(rows).toHaveLength(1)
        expect(rows[0].token).not.toBe(token) // never the secret itself
        expect(rows[0].token).toBe(hashResetToken(token!))
    })

    test("a new link replaces the earlier one", async () => {
        const t = await createTarget()
        await signInAs(demo("admin"))
        await call(resetLink, { params: { id: t.id } })
        await call(resetLink, { params: { id: t.id } })
        expect(await prisma.passwordResetToken.count({ where: { email: t.email } })).toBe(1)
    })

    test("refused for a support agent", async () => {
        const t = await createTarget()
        await signInAs(demo("support"))
        expect((await call(resetLink, { params: { id: t.id } })).status).toBe(403)
    })
})
