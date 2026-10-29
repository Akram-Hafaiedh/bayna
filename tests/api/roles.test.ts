// tests/api/roles.test.ts
// The role routes of a shop: creating, changing and deleting a role.
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { POST as createRole } from "@/app/api/roles/route"
import { PATCH as updateRole, DELETE as deleteRole } from "@/app/api/roles/[id]/route"
import { COMPANY_NAMES, SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { call, cleanUp, createTarget, demo, prisma, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let tunis = ""
const roles: string[] = []
const users: string[] = []

beforeAll(async () => {
    tunis = (await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.tunis }, select: { id: true } })).id
})

afterEach(() => signOut())
afterAll(async () => {
    await prisma.accessAssignment.deleteMany({ where: { roleId: { in: roles } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.accessRole.deleteMany({ where: { id: { in: roles } } })
    await cleanUp()
})

const roleName = () => `api-test-role-${randomUUID().slice(0, 8)}`
const body = (over: Record<string, unknown> = {}) => ({
    scope: "SHOP", targetId: tunis, name: roleName(), description: "made by a test", permissions: ["product.listing.view"], ...over,
})

/** A role in the Tunis shop made straight in the database, to change or delete. */
async function aRole(permissions: string[] = ["product.listing.view"]) {
    const r = await prisma.accessRole.create({
        data: { name: roleName(), scope: "SHOP", providerId: tunis, permissions },
        select: { id: true, name: true },
    })
    roles.push(r.id)
    return r
}

describe("creating a role", () => {
    test("needs a signed-in person who manages roles in that shop", async () => {
        signOut()
        expect((await call(createRole, { body: body() })).status).toBe(401)
        await signInAs(demo("client"))
        expect((await call(createRole, { body: body() })).status).toBe(403)
        await signInAs(demo("viewer"))
        expect((await call(createRole, { body: body() })).status).toBe(403)
        await signInAs(demo("manager-marsa"))
        expect((await call(createRole, { body: body() })).status).toBe(403)
    })

    test("a bad request is a 400", async () => {
        await signInAs(OWNER)
        expect((await call(createRole, { body: {} })).status).toBe(400)
        expect((await call(createRole, { body: body({ scope: "PLATFORM" }) })).status).toBe(400)
        expect((await call(createRole, { body: body({ name: "x" }) })).status).toBe(400)
        expect((await call(createRole, { body: body({ permissions: [] }) })).status).toBe(400)
        expect((await call(createRole, { body: body({ permissions: ["not.a.permission"] }) })).status).toBe(400)
    })

    test("an owner creates a role: saved in that shop and logged", async () => {
        await signInAs(OWNER)
        const b = body()
        const res = await call(createRole, { body: b })
        expect(res.status).toBe(201)
        const id = (res.json?.role as { id: string }).id
        roles.push(id)

        const row = await prisma.accessRole.findUniqueOrThrow({ where: { id } })
        expect(row).toMatchObject({ name: b.name, scope: "SHOP", providerId: tunis, businessId: null })
        expect(row.permissions).toEqual(["product.listing.view"])
        expect(await prisma.activityLog.count({ where: { action: "TEAM_ROLE_CREATED", entityId: id, providerId: tunis } })).toBe(1)
    })

    test("two roles of one shop cannot share a name", async () => {
        await signInAs(OWNER)
        const b = body()
        const first = await call(createRole, { body: b })
        roles.push((first.json?.role as { id: string }).id)
        expect((await call(createRole, { body: b })).status).toBe(409)
    })
})

describe("changing a role", () => {
    test("an owner changes the name and permissions, and it is logged", async () => {
        const r = await aRole()
        await signInAs(OWNER)
        const next = roleName()
        const res = await call(updateRole, { method: "PATCH", params: { id: r.id }, body: { name: next, permissions: ["product.listing.view", "product.listing.create"] } })
        expect(res.status).toBe(200)
        const row = await prisma.accessRole.findUniqueOrThrow({ where: { id: r.id } })
        expect(row.name).toBe(next)
        expect(row.permissions).toEqual(["product.listing.create", "product.listing.view"])
        expect(await prisma.activityLog.count({ where: { action: "TEAM_ROLE_UPDATED", entityId: r.id } })).toBe(1)
    })

    test("needs the permission, and an unknown role is a 404", async () => {
        const r = await aRole()
        const b = { name: roleName(), permissions: ["product.listing.view"] }
        signOut()
        expect((await call(updateRole, { method: "PATCH", params: { id: r.id }, body: b })).status).toBe(401)
        await signInAs(demo("viewer"))
        expect((await call(updateRole, { method: "PATCH", params: { id: r.id }, body: b })).status).toBe(403)
        await signInAs(OWNER)
        expect((await call(updateRole, { method: "PATCH", params: { id: "nope" }, body: b })).status).toBe(404)
        expect((await prisma.accessRole.findUniqueOrThrow({ where: { id: r.id } })).name).toBe(r.name)
    })

    test("a name already used by another role of the shop is refused", async () => {
        const a = await aRole()
        const b = await aRole()
        await signInAs(OWNER)
        const res = await call(updateRole, { method: "PATCH", params: { id: b.id }, body: { name: a.name, permissions: ["product.listing.view"] } })
        expect(res.status).toBe(409)
    })

    test("the owner role of a business cannot lose its ownership: someone has to keep it", async () => {
        const owner = await prisma.accessRole.findFirstOrThrow({ where: { scope: "BUSINESS", name: "Business owner", business: { name: COMPANY_NAMES.carthage } }, select: { id: true, name: true } })
        await signInAs(OWNER)
        const res = await call(updateRole, { method: "PATCH", params: { id: owner.id }, body: { name: owner.name, permissions: ["business.role.view"] } })
        expect(res.status).toBe(409)
    })
})

describe("deleting a role", () => {
    test("an unused role is deleted and the log says so", async () => {
        const r = await aRole()
        await signInAs(OWNER)
        const res = await call(deleteRole, { method: "DELETE", params: { id: r.id } })
        expect(res.status).toBe(200)
        expect(await prisma.accessRole.count({ where: { id: r.id } })).toBe(0)
        expect(await prisma.activityLog.count({ where: { action: "TEAM_ROLE_DELETED", entityId: r.id } })).toBe(1)
    })

    test("a role somebody holds is kept", async () => {
        const r = await aRole()
        const u = await createTarget("holder")
        users.push(u.id)
        await prisma.accessAssignment.create({ data: { userId: u.id, roleId: r.id, scope: "SHOP", providerId: tunis, status: "ACTIVE" } })
        await signInAs(OWNER)
        const res = await call(deleteRole, { method: "DELETE", params: { id: r.id } })
        expect(res.status).toBe(409)
        expect(await prisma.accessRole.count({ where: { id: r.id } })).toBe(1)
    })

    test("needs the permission, and an unknown role is a 404", async () => {
        const r = await aRole()
        signOut()
        expect((await call(deleteRole, { method: "DELETE", params: { id: r.id } })).status).toBe(401)
        await signInAs(demo("viewer"))
        expect((await call(deleteRole, { method: "DELETE", params: { id: r.id } })).status).toBe(403)
        await signInAs(OWNER)
        expect((await call(deleteRole, { method: "DELETE", params: { id: "nope" } })).status).toBe(404)
        expect(await prisma.accessRole.count({ where: { id: r.id } })).toBe(1)
    })
})
