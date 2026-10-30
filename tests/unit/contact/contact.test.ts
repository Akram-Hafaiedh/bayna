// tests/unit/contact/contact.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    CONTACT_TOPICS, MESSAGE_MAX, RATE_LIMIT, buildContactHref, checkRate, contactMoves, parseContactInput, parseContactQuery,
    replyHref, topicLabel,
} from "@/lib/contact"

const good = { name: "  Sami   Ben Ali ", email: " Sami@Mail.com ", topic: "SHOP", message: "My shop is still waiting for approval." }

test("a good message is tidied and accepted", () => {
    const r = parseContactInput(good)
    assert.ok(r.ok)
    if (r.ok) {
        assert.equal(r.value.name, "Sami Ben Ali")
        assert.equal(r.value.email, "sami@mail.com")
        assert.equal(r.value.topic, "SHOP")
    }
})

test("each missing or bad field gets its own message", () => {
    const err = (o: object) => { const r = parseContactInput({ ...good, ...o }); return r.ok ? null : "error" in r ? r.error : "spam" }
    assert.match(err({ name: "A" })!, /name/i)
    assert.match(err({ email: "nope" })!, /email/i)
    assert.match(err({ topic: "NOPE" })!, /about/i)
    assert.match(err({ topic: undefined })!, /about/i)
    assert.match(err({ message: "short" })!, /more/i)
    assert.match(err({ message: "x".repeat(MESSAGE_MAX + 1) })!, /too long/i)
    assert.equal(parseContactInput(null).ok, false)
    assert.equal(parseContactInput("text").ok, false)
})

test("line breaks stay, runs of blank lines and spaces collapse", () => {
    const r = parseContactInput({ ...good, message: "Hello   there\r\n\r\n\r\n\r\nSecond   line here" })
    assert.ok(r.ok && r.value.message === "Hello there\n\nSecond line here")
})

test("a filled hidden field is a robot, and is not an error the robot can learn from", () => {
    const r = parseContactInput({ ...good, website: "http://spam.example" })
    assert.deepEqual(r, { ok: false, spam: true })
    assert.equal(parseContactInput({ ...good, website: "  " }).ok, true)
})

test("a sender is slowed down after a few messages", () => {
    assert.equal(checkRate({ lastHour: 0, lastDay: 0 }).ok, true)
    assert.equal(checkRate({ lastHour: RATE_LIMIT.perHour - 1, lastDay: 5 }).ok, true)
    assert.equal(checkRate({ lastHour: RATE_LIMIT.perHour, lastDay: 3 }).ok, false)
    assert.equal(checkRate({ lastHour: 0, lastDay: RATE_LIMIT.perDay }).ok, false)
})

test("every topic has a label and the labels are unique", () => {
    const labels = CONTACT_TOPICS.map((t) => t.label)
    assert.equal(new Set(labels).size, labels.length)
    assert.equal(topicLabel("PRIVACY"), "My personal information")
    assert.equal(topicLabel("UNKNOWN"), "UNKNOWN")
})

test("the team can always move a message somewhere, never to where it already is", () => {
    for (const s of ["NEW", "READ", "HANDLED"] as const) {
        const moves = contactMoves(s)
        assert.ok(moves.length > 0)
        assert.ok(moves.every((m) => m.to !== s))
    }
})

test("the reply link names the topic", () => {
    const href = replyHref({ email: "a@b.tn", topic: "SHOP" })
    assert.ok(href.startsWith("mailto:a@b.tn?subject="))
    assert.ok(decodeURIComponent(href).includes("My shop or business"))
})

test("the inbox opens on New, and reads the filter and page from the address", () => {
    assert.deepEqual(parseContactQuery({}), { status: "NEW", page: 1, pageSize: 25 })
    assert.deepEqual(parseContactQuery({ status: "handled", page: "3", pageSize: "50" }), { status: "HANDLED", page: 3, pageSize: 50 })
    assert.equal(parseContactQuery({ status: "all" }).status, "all")
    assert.deepEqual(parseContactQuery({ status: "zzz", page: "-4", pageSize: "7" }), { status: "NEW", page: 1, pageSize: 25 })
})

test("links keep the filter, and a new filter or size goes back to page one", () => {
    const q = parseContactQuery({ status: "read", page: "4" })
    assert.equal(buildContactHref(q, { page: 5 }), "/admin/messages?status=read&page=5")
    assert.equal(buildContactHref(q, { status: "all" }), "/admin/messages?status=all")
    assert.equal(buildContactHref(q, { pageSize: 50 }), "/admin/messages?status=read&pageSize=50")
    assert.equal(buildContactHref(parseContactQuery({}), {}), "/admin/messages")
})
