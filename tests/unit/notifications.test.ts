// lib/notifications.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { BODY_MAX, TITLE_MAX, buildNotifications, notifications } from "@/lib/notifications"
import { timeAgo } from "@/lib/time-ago"

test("one row per distinct recipient, blanks dropped", () => {
    const rows = buildNotifications(["u1", "u2", "u1", "", null, undefined, "  "], { type: "t", title: "Hello" })
    assert.deepEqual(rows.map((r) => r.userId), ["u1", "u2"])
})

test("a single recipient can be passed as a string", () => {
    assert.equal(buildNotifications("u1", { type: "t", title: "Hello" }).length, 1)
    assert.equal(buildNotifications("", { type: "t", title: "Hello" }).length, 0)
})

test("text is trimmed and cut to length, empty body becomes null", () => {
    const [row] = buildNotifications("u1", { type: " t ", title: `  ${"x".repeat(500)}  `, body: "y".repeat(900) })
    assert.equal(row.type, "t")
    assert.equal(row.title.length, TITLE_MAX)
    assert.equal(row.body?.length, BODY_MAX)
    assert.equal(buildNotifications("u1", { type: "t", title: "a", body: "   " })[0].body, null)
})

test("a notification needs a type and a title", () => {
    assert.throws(() => buildNotifications("u1", { type: "t", title: "  " }))
    assert.throws(() => buildNotifications("u1", { type: " ", title: "a" }))
})

test("links must be paths inside the app", () => {
    const href = (h: string) => buildNotifications("u1", { type: "t", title: "a", href: h })[0].href
    assert.equal(href("/shop/abc/profile"), "/shop/abc/profile")
    assert.equal(href("https://evil.example"), null)
    assert.equal(href("//evil.example"), null)
    assert.equal(href("javascript:alert(1)"), null)
    assert.equal(href(""), null)
})

test("the ready-made messages are valid", () => {
    const sample = { shop: "abc", itemName: "Cement", reason: "Unit changed from Piece to Bag", count: 2 }
    const messages = [
        notifications.applicationApproved({ shop: "abc" }),
        notifications.applicationRejected(),
        notifications.priceReviewNeeded(sample),
        notifications.profileReviewed({ shop: "abc" }),
        notifications.teamJoined({ who: "Sami", where: "Sfax BTP", role: "Manager" }),
        notifications.teamRoleChanged({ where: "Sfax BTP", role: "Viewer" }),
        notifications.teamSuspended({ where: "Sfax BTP" }),
        notifications.teamReinstated({ where: "Sfax BTP" }),
        notifications.teamRemoved({ where: "Sfax BTP" }),
        notifications.accountDeletionCancelled(),
        notifications.supportViewedAccount(),
    ]
    // Fails if a builder is added to `notifications` without being listed here.
    assert.equal(messages.length, Object.keys(notifications).length)
    for (const message of messages) {
        const [row] = buildNotifications("u1", message)
        assert.ok(row.title.length > 0 && row.href?.startsWith("/"))
    }
    assert.match(notifications.priceReviewNeeded(sample).body ?? "", /2 products/)
    assert.match(notifications.priceReviewNeeded({ ...sample, count: 1 }).body ?? "", /1 product\b/)
})

test("timeAgo", () => {
    const now = new Date("2026-10-16T12:00:00Z")
    const ago = (s: number) => timeAgo(new Date(now.getTime() - s * 1000), now)
    assert.equal(ago(5), "just now")
    assert.equal(ago(5 * 60), "5 min ago")
    assert.equal(ago(3 * 3600), "3 h ago")
    assert.equal(ago(2 * 86400), "2 d ago")
    assert.equal(ago(10 * 86400), "2026-10-06")
    assert.equal(timeAgo("not a date", now), "just now")
})
