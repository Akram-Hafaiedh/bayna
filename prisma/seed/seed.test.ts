// prisma/seed/seed.test.ts
// Checks the seed data (it lives in the seeder files) and the run plan without a database. Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { templatesFor } from "../../lib/access/role-templates"
import { COMPANIES } from "./seeders/businesses"
import { ROOTS } from "./seeders/catalogue"
import { SHOPS } from "./seeders/shops"
import { INVITES, PEOPLE, SHOP_NAMES, COMPANY_NAMES, type Place } from "./seeders/users"
import { checkSeeders, planRun } from "./plan"
import type { Seeder } from "./core"

const fake = (name: string, kind: Seeder["kind"], needs: string[] = []): Seeder => ({
    name, kind, description: name, needs, run: async () => "ok",
})

test("category and item slugs are unique", () => {
    const slugs = ROOTS.flatMap((r) => [r.slug, ...r.categories.map((c) => c.slug)])
    assert.equal(new Set(slugs).size, slugs.length)
    for (const r of ROOTS) {
        const names = r.categories.flatMap((c) => c.items.map((i) => `${c.slug}/${i.name}`))
        assert.equal(new Set(names).size, names.length, `duplicate item in ${r.name}`)
    }
})

test("every shop belongs to a company that exists, and keys and names are unique", () => {
    const companies = new Set(COMPANIES.map((c) => c.name))
    assert.equal(companies.size, COMPANIES.length)
    for (const s of SHOPS) assert.ok(companies.has(s.company), `${s.name}: unknown company ${s.company}`)
    assert.equal(new Set(SHOPS.map((s) => s.key)).size, SHOPS.length)
    assert.equal(new Set(SHOPS.map((s) => `${s.ownerEmail}/${s.name}`)).size, SHOPS.length)
})

test("shop coverage uses real root categories", () => {
    const roots = new Set(ROOTS.map((r) => r.slug))
    for (const s of SHOPS) for (const root of Object.keys(s.coverage)) assert.ok(roots.has(root), `${s.name}: unknown vertical ${root}`)
})

test("test users: places and roles exist", () => {
    const shopNames = new Set(SHOPS.map((s) => s.name))
    for (const n of Object.values(SHOP_NAMES)) assert.ok(shopNames.has(n), `no seeded shop named ${n}`)
    const companies = new Set(COMPANIES.map((c) => c.name))
    for (const n of Object.values(COMPANY_NAMES)) assert.ok(companies.has(n), `no seeded company named ${n}`)

    const roleNames = (scope: "PLATFORM" | "BUSINESS" | "SHOP") => new Set(templatesFor(scope).map((t) => t.name))
    const check = (place: Place, role: string, who: string) =>
        assert.ok(roleNames(place.level).has(role), `${who}: no default ${place.level} role named "${role}"`)
    for (const p of PEOPLE) {
        for (const g of p.grants) check(g.place, g.role, p.local)
        if (p.platformRole) assert.ok(roleNames("PLATFORM").has(p.platformRole), `${p.local}: no platform role ${p.platformRole}`)
    }
    for (const i of INVITES) check(i.place, i.role, `invite ${i.label}`)
})

test("test user locals and invite labels are unique", () => {
    assert.equal(new Set(PEOPLE.map((p) => p.local)).size, PEOPLE.length)
    assert.equal(new Set(INVITES.map((i) => i.label)).size, INVITES.length)
})

test("planRun keeps the canonical order and honours only, skip and kind", () => {
    const all = [fake("a", "reference"), fake("b", "reference", ["a"]), fake("c", "demo", ["b"]), fake("d", "test", ["c"])]
    assert.deepEqual(planRun(all).run.map((s) => s.name), ["a", "b", "c", "d"])
    assert.deepEqual(planRun(all, { only: ["d", "a"], exact: true }).run.map((s) => s.name), ["a", "d"])
    assert.deepEqual(planRun(all, { skip: ["b", "d"] }).run.map((s) => s.name), ["a", "c"])
    assert.deepEqual(planRun(all, { kind: "demo" }).run.map((s) => s.name), ["c"])
})

test("planRun adds what the named seeders need, transitively, unless exact", () => {
    const all = [fake("a", "reference"), fake("x", "reference"), fake("b", "reference", ["a"]), fake("c", "demo", ["b"]), fake("d", "test", ["c"])]
    assert.deepEqual(planRun(all, { only: ["c"] }).run.map((s) => s.name), ["a", "b", "c"])
    assert.deepEqual(planRun(all, { only: ["d"] }).run.map((s) => s.name), ["a", "b", "c", "d"])
    assert.deepEqual(planRun(all, { only: ["c"], exact: true }).run.map((s) => s.name), ["c"])
    assert.deepEqual(planRun(all, { only: ["c"], skip: ["a"] }).run.map((s) => s.name), ["b", "c"])
})

test("planRun refuses unknown names and keeps demo and test data out of production", () => {
    const all = [fake("a", "reference"), fake("c", "demo"), fake("d", "test")]
    assert.match(planRun(all, { only: ["zzz"] }).problems[0], /Unknown seeder "zzz"/)
    const prod = planRun(all, { production: true })
    assert.deepEqual(prod.run.map((s) => s.name), ["a"])
    assert.deepEqual(prod.skippedForProduction, ["c", "d"])
})

test("checkSeeders finds needs that do not exist or run later", () => {
    assert.deepEqual(checkSeeders([fake("a", "reference"), fake("b", "demo", ["a"])]), [])
    assert.equal(checkSeeders([fake("b", "demo", ["a"]), fake("a", "reference")]).length, 1)
    assert.equal(checkSeeders([fake("a", "reference"), fake("a", "reference")]).length, 1)
})
