// lib/audit/actor.test.ts
// Run: npm run test:unit   (Vitest)
import { test } from "vitest"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { actorFromSession, requestMeta, serializeActor, systemActor } from "./actor"

const parse = (actor: Parameters<typeof serializeActor>[0]) => JSON.parse(serializeActor(actor))

test("serializeActor fills defaults and nulls", () => {
    assert.deepEqual(parse({ actorId: null }), {
        actorId: null,
        actorName: null,
        actorRole: null,
        onBehalfOfId: null,
        impersonationId: null,
        source: "SYSTEM",
        requestId: null,
        ip: null,
        userAgent: null,
    })
})

test("serializeActor limits text length and keeps ids intact", () => {
    const out = parse({ actorId: "u1", userAgent: "x".repeat(900), actorName: "n".repeat(900) })
    assert.equal(out.userAgent.length, 500)
    assert.equal(out.actorName.length, 500)
    assert.equal(out.actorId, "u1")
})

test("serializeActor writes exactly the keys the SQL trigger reads", () => {
    // Looks through every migration, so the folder name does not matter.
    const dir = join(process.cwd(), "prisma", "migrations")
    const sql = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => readFileSync(join(dir, d.name, "migration.sql"), "utf8"))
        .join("\n")
    assert.ok(sql.includes("audit_log()"), "no migration defines the audit triggers (audit_log function)")
    for (const key of Object.keys(parse({ actorId: null }))) {
        assert.ok(sql.includes(`ctx ->> '${key}'`), `trigger SQL never reads "${key}"`)
    }
})

test("actorFromSession maps a signed-in user", () => {
    const actor = actorFromSession({ user: { id: "u1", name: "Sami", email: "s@x.tn", role: "ADMIN" } })
    assert.equal(actor.actorId, "u1")
    assert.equal(actor.actorName, "Sami")
    assert.equal(actor.actorRole, "ADMIN")
    assert.equal(actor.source, "WEB")
})

test("actorFromSession falls back to the email when there is no name", () => {
    assert.equal(actorFromSession({ user: { id: "u1", name: null, email: "s@x.tn" } }).actorName, "s@x.tn")
})

test("actorFromSession treats a missing session and a revoked login (empty id) as anonymous", () => {
    assert.equal(actorFromSession(null).actorId, null)
    assert.equal(actorFromSession(undefined).actorId, null)
    assert.equal(actorFromSession({ user: { id: "" } }).actorId, null)
})

test("actorFromSession merges request metadata and lets extra values win", () => {
    const actor = actorFromSession(
        { user: { id: "admin1" } },
        { requestId: "r1", ip: "203.0.113.9", userAgent: "UA" },
        { onBehalfOfId: "u9", impersonationId: "imp1", source: "API" }
    )
    assert.equal(actor.requestId, "r1")
    assert.equal(actor.ip, "203.0.113.9")
    assert.equal(actor.onBehalfOfId, "u9")
    assert.equal(actor.impersonationId, "imp1")
    assert.equal(actor.source, "API")
})

test("requestMeta takes the first forwarded address and falls back to x-real-ip", () => {
    const first = requestMeta(new Request("https://x.test", { headers: { "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" } }))
    assert.equal(first.ip, "203.0.113.9")
    const real = requestMeta(new Request("https://x.test", { headers: { "x-real-ip": "198.51.100.7" } }))
    assert.equal(real.ip, "198.51.100.7")
    assert.equal(requestMeta(new Request("https://x.test")).ip, null)
})

test("requestMeta reuses x-request-id or generates a uuid", () => {
    assert.equal(requestMeta(new Request("https://x.test", { headers: { "x-request-id": "abc" } })).requestId, "abc")
    assert.match(
        requestMeta(new Request("https://x.test")).requestId ?? "",
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
})

test("requestMeta limits a long user agent", () => {
    const meta = requestMeta(new Request("https://x.test", { headers: { "user-agent": "u".repeat(900) } }))
    assert.equal(meta.userAgent?.length, 500)
})

test("systemActor has no person and a labelled source", () => {
    assert.deepEqual(systemActor("SEED"), { actorId: null, actorName: "System", source: "SEED" })
})
