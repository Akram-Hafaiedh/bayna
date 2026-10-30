// tests/api/guards.test.ts
// Who may do what: requirePlatform and requireShop against the demo accounts (prisma/seed/seeders/users.ts).
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { requirePlatform, requireShop } from "@/lib/access/guard"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { SHOP_HEADER } from "@/lib/shops/shop-paths"
import { cleanUp, demo, freshEmail, prisma, signInAs, signOut } from "./helpers"

const req = (shopPublicId?: string) =>
    new Request("http://localhost/api/test", { headers: shopPublicId ? { [SHOP_HEADER]: shopPublicId } : {} })

const shopId: Record<"tunis" | "marsa" | "sfax", string> = { tunis: "", marsa: "", sfax: "" }
const publicShopId: Record<"tunis" | "marsa" | "sfax", string> = { tunis: "", marsa: "", sfax: "" }

beforeAll(async () => {
    for (const key of ["tunis", "marsa", "sfax"] as const) {
        const shop = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES[key] }, select: { id: true, publicShopId: true } })
        shopId[key] = shop.id
        publicShopId[key] = shop.publicShopId
    }
})

afterEach(() => signOut())
afterAll(cleanUp)

describe("requirePlatform", () => {
    test("nobody signed in: 401", async () => {
        signOut()
        const g = await requirePlatform("user.account.view", req())
        expect(g).toMatchObject({ ok: false, status: 401 })
    })

    test("a plain client is refused: 403", async () => {
        await signInAs(demo("client"))
        expect(await requirePlatform("user.account.view", req())).toMatchObject({ ok: false, status: 403 })
    })

    test("a shop manager is not platform staff: 403", async () => {
        await signInAs(demo("manager-tunis"))
        expect(await requirePlatform("user.account.view", req())).toMatchObject({ ok: false, status: 403 })
    })

    test("a super admin may do anything", async () => {
        await signInAs(demo("admin"))
        expect(await requirePlatform("user.account.suspend", req())).toMatchObject({ ok: true })
    })

    test("a support agent may look at users but not suspend them", async () => {
        await signInAs(demo("support"))
        expect(await requirePlatform("user.account.view", req())).toMatchObject({ ok: true })
        expect(await requirePlatform("user.account.suspend", req())).toMatchObject({ ok: false, status: 403 })
    })

    test("a moderator has no say over accounts", async () => {
        await signInAs(demo("moderator"))
        expect(await requirePlatform("user.account.view", req())).toMatchObject({ ok: false, status: 403 })
    })

    test("a suspended account is refused with a clear message, even for a super admin", async () => {
        const target = await prisma.user.findUniqueOrThrow({ where: { email: demo("support") }, select: { id: true } })
        await prisma.user.update({ where: { id: target.id }, data: { status: "SUSPENDED" } })
        try {
            await signInAs(demo("support"))
            expect(await requirePlatform("user.account.view", req())).toMatchObject({ ok: false, status: 403, error: "Your account is suspended" })
        } finally {
            await prisma.user.update({ where: { id: target.id }, data: { status: "ACTIVE" } })
        }
    })
})

describe("requireShop", () => {
    test("nobody signed in: 401", async () => {
        signOut()
        expect(await requireShop("product.listing.view", req(publicShopId.tunis))).toMatchObject({ ok: false, status: 401 })
    })

    test("a viewer can read products but cannot create, edit or change prices", async () => {
        await signInAs(demo("viewer"))
        const r = req(publicShopId.tunis)
        expect(await requireShop("product.listing.view", r)).toMatchObject({ ok: true })
        expect(await requireShop("product.listing.create", r)).toMatchObject({ ok: false, status: 403 })
        expect(await requireShop("product.listing.edit", r)).toMatchObject({ ok: false, status: 403 })
        expect(await requireShop("product.price.edit", r)).toMatchObject({ ok: false, status: 403 })
    })

    test("a viewer of two shops works in the one the header names", async () => {
        await signInAs(demo("viewer"))
        const a = await requireShop("product.listing.view", req(publicShopId.tunis))
        const b = await requireShop("product.listing.view", req(publicShopId.marsa))
        expect(a).toMatchObject({ ok: true, shop: { id: shopId.tunis } })
        expect(b).toMatchObject({ ok: true, shop: { id: shopId.marsa } })
    })

    test("naming a shop you do not work in is refused, even if you work in another one", async () => {
        await signInAs(demo("manager-tunis"))
        expect(await requireShop("product.listing.view", req(publicShopId.marsa))).toMatchObject({ ok: false, status: 403 })
        expect(await requireShop("product.listing.view", req(publicShopId.sfax))).toMatchObject({ ok: false, status: 403 })
        expect(await requireShop("product.listing.view", req("not-a-real-shop-id"))).toMatchObject({ ok: false, status: 403 })
    })

    test("without the header, a person with one shop gets that shop", async () => {
        await signInAs(demo("manager-tunis"))
        expect(await requireShop("product.listing.view", req())).toMatchObject({ ok: true, shop: { id: shopId.tunis } })
    })

    test("a business-level role reaches every shop of its business", async () => {
        await signInAs(demo("operations"))
        expect(await requireShop("product.listing.view", req(publicShopId.tunis))).toMatchObject({ ok: true })
        expect(await requireShop("product.listing.view", req(publicShopId.marsa))).toMatchObject({ ok: true })
        // ...but not the shops of another business
        expect(await requireShop("product.listing.view", req(publicShopId.sfax))).toMatchObject({ ok: false, status: 403 })
    })

    test("a role that was suspended or has expired gives no access", async () => {
        await signInAs(demo("suspended"))
        expect(await requireShop("product.listing.view", req(publicShopId.tunis))).toMatchObject({ ok: false, status: 403 })
        await signInAs(demo("expired"))
        expect(await requireShop("product.listing.view", req(publicShopId.tunis))).toMatchObject({ ok: false, status: 403 })
    })

    test("an order handler works with orders but not with products", async () => {
        await signInAs(demo("orders"))
        const r = req(publicShopId.tunis)
        expect(await requireShop("order.request.view_all", r)).toMatchObject({ ok: true })
        expect(await requireShop("product.listing.edit", r)).toMatchObject({ ok: false, status: 403 })
    })

    test("a closed shop is refused for everyone who works in it", async () => {
        await prisma.shop.update({ where: { id: shopId.tunis }, data: { status: "CLOSED" } })
        try {
            await signInAs(demo("manager-tunis"))
            expect(await requireShop("product.listing.view", req(publicShopId.tunis))).toMatchObject({
                ok: false, status: 403, error: "This shop is closed or suspended",
            })
        } finally {
            await prisma.shop.update({ where: { id: shopId.tunis }, data: { status: "ACTIVE" } })
        }
    })

    test("an applicant whose shop is still waiting is told so", async () => {
        const email = freshEmail("applicant")
        const user = await prisma.user.create({ data: { email, name: "Applicant", password: "x", role: "COMPANY" }, select: { id: true } })
        const business = await prisma.business.create({ data: { name: "API test business" }, select: { id: true } })
        await prisma.shop.create({ data: { applicantId: user.id, businessId: business.id, name: "API test shop", city: "Tunis", status: "PENDING" } })
        try {
            await signInAs(email)
            expect(await requireShop("product.listing.view", req())).toMatchObject({
                ok: false, status: 403, error: "Your shop is not approved yet",
            })
        } finally {
            await prisma.shop.deleteMany({ where: { businessId: business.id } })
            await prisma.business.delete({ where: { id: business.id } })
        }
    })

    test("a suspended account is refused before anything else", async () => {
        const target = await prisma.user.findUniqueOrThrow({ where: { email: demo("manager-tunis") }, select: { id: true } })
        await prisma.user.update({ where: { id: target.id }, data: { status: "SUSPENDED" } })
        try {
            await signInAs(demo("manager-tunis"))
            expect(await requireShop("product.listing.view", req(publicShopId.tunis))).toMatchObject({
                ok: false, status: 403, error: "Your account is suspended",
            })
        } finally {
            await prisma.user.update({ where: { id: target.id }, data: { status: "ACTIVE" } })
        }
    })
})
