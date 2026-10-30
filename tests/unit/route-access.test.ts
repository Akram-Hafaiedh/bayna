// lib/route-access.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { decideRoute, homeFor } from "@/lib/auth/route-access"

const as = (role: string) => ({ id: "u1", role })
const go = (pathname: string, user: { id?: string | null; role?: string | null } | null, viewAsRole?: string) =>
    decideRoute({ pathname, user, viewAsRole })

test("public pages are open to everyone", () => {
    for (const p of ["/", "/login", "/plans", "/contact", "/invite/abc", "/shops/some-shop"]) {
        assert.deepEqual(go(p, null), { type: "next" })
    }
})

test("a protected page sends a stranger to the sign-in page", () => {
    for (const p of ["/admin/users", "/shop/abc/products", "/business/shops", "/dashboard", "/profile", "/become-shop"]) {
        assert.deepEqual(go(p, null), { type: "redirect", to: "/login" })
        // a session without an id (a revoked login) is the same as nobody
        assert.deepEqual(go(p, { id: "", role: "CLIENT" }), { type: "redirect", to: "/login" })
    }
})

test("each role opens its own area and is sent home from the others", () => {
    assert.deepEqual(go("/admin/users", as("ADMIN")), { type: "next" })
    assert.deepEqual(go("/admin/users", as("CLIENT")), { type: "redirect", to: "/dashboard" })
    assert.deepEqual(go("/admin/users", as("COMPANY")), { type: "redirect", to: "/shop" })

    assert.deepEqual(go("/shop/abc/products", as("COMPANY")), { type: "next" })
    assert.deepEqual(go("/business/shops", as("COMPANY")), { type: "next" })
    assert.deepEqual(go("/shop/abc/products", as("CLIENT")), { type: "redirect", to: "/dashboard" })
    assert.deepEqual(go("/business/shops", as("ADMIN")), { type: "redirect", to: "/admin/dashboard" })

    assert.deepEqual(go("/dashboard", as("CLIENT")), { type: "next" })
    assert.deepEqual(go("/dashboard", as("COMPANY")), { type: "redirect", to: "/shop" })
})

test("profile and become-shop are open to any signed-in person", () => {
    for (const role of ["ADMIN", "COMPANY", "CLIENT"]) {
        assert.deepEqual(go("/profile", as(role)), { type: "next" })
        assert.deepEqual(go("/become-shop", as(role)), { type: "next" })
    }
})

test("a prefix only matches whole path segments", () => {
    // "/administrator" and "/shops" are not "/admin" and "/shop"
    assert.deepEqual(go("/administrator", as("CLIENT")), { type: "next" })
    assert.deepEqual(go("/shops", as("CLIENT")), { type: "next" })
    assert.deepEqual(go("/admin", as("CLIENT")), { type: "redirect", to: "/dashboard" })
})

test("a staff member viewing another account is routed as that account, and only then", () => {
    assert.deepEqual(go("/dashboard", as("ADMIN"), "CLIENT"), { type: "next" })
    assert.deepEqual(go("/admin/users", as("ADMIN"), "CLIENT"), { type: "redirect", to: "/dashboard" })
    assert.deepEqual(go("/shop/abc/products", as("ADMIN"), "COMPANY"), { type: "next" })
    // the cookie means nothing to anyone who is not an admin
    assert.deepEqual(go("/admin/users", as("CLIENT"), "ADMIN"), { type: "redirect", to: "/dashboard" })
    assert.deepEqual(go("/dashboard", as("COMPANY"), "CLIENT"), { type: "redirect", to: "/shop" })
})

test("an unknown role goes to the home page", () => {
    assert.equal(homeFor(undefined), "/")
    assert.equal(homeFor("SOMETHING"), "/")
    assert.deepEqual(go("/dashboard", as("SOMETHING")), { type: "redirect", to: "/" })
})
