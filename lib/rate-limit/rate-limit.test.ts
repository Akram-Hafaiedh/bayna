import { expect, test } from "vitest"
import { createLimiter, storageKey, type HitResult, type SharedStore } from "./limiter"
import { RATE, messageForRateLimitCode, RATE_LIMITED_CODE } from "./policies"

const policy = { name: "t", limit: 3, windowMs: 60_000 }

/** A shared store in memory, standing in for Postgres; `calls` counts how often it was used. */
function fakeShared(clock: { t: number }) {
    const rows = new Map<string, { count: number; resetAt: number }>()
    const left = (r: { resetAt: number }) => r.resetAt - clock.t
    const store = {
        calls: 0,
        fail: false as boolean,
        rows,
        async hit(key: string, windowMs: number): Promise<HitResult> {
            store.calls++
            if (store.fail) throw new Error("db down")
            let r = rows.get(key)
            if (!r || r.resetAt <= clock.t) r = { count: 0, resetAt: clock.t + windowMs }
            r.count++
            rows.set(key, r)
            return { count: r.count, retryMs: left(r) }
        },
        async peek(key: string): Promise<HitResult | null> {
            store.calls++
            if (store.fail) throw new Error("db down")
            const r = rows.get(key)
            return r && r.resetAt > clock.t ? { count: r.count, retryMs: left(r) } : null
        },
        async clear(key: string) {
            rows.delete(key)
        },
    }
    const asShared: SharedStore = store // the fake must keep matching the real interface
    void asShared
    return store
}

function setup() {
    const clock = { t: 1_000_000 }
    const shared = fakeShared(clock)
    const make = () => createLimiter({ shared, now: () => clock.t })
    return { clock, shared, make }
}

test("hit allows the limit, refuses the next try, and says how long to wait", async () => {
    const { make } = setup()
    const l = make()
    for (let i = 0; i < 3; i++) expect((await l.hit(policy, "a@x.com")).ok).toBe(true)
    const r = await l.hit(policy, "a@x.com")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.retryAfterSec).toBe(60)
})

test("a key already over its limit is refused by memory without touching the shared store", async () => {
    const { shared, make } = setup()
    const l = make()
    for (let i = 0; i < 4; i++) await l.hit(policy, "a@x.com")
    const before = shared.calls
    expect((await l.hit(policy, "a@x.com")).ok).toBe(false)
    expect(shared.calls).toBe(before)
})

test("two instances share one count through the shared store", async () => {
    const { make } = setup()
    const one = make()
    const two = make()
    await one.hit(policy, "a@x.com")
    await one.hit(policy, "a@x.com")
    await two.hit(policy, "a@x.com")
    // Each instance alone has seen at most 2 tries, but together it is the 4th
    expect((await two.hit(policy, "a@x.com")).ok).toBe(false)
})

test("the window ends and counting starts again", async () => {
    const { clock, make } = setup()
    const l = make()
    for (let i = 0; i < 4; i++) await l.hit(policy, "a@x.com")
    clock.t += 60_001
    expect((await l.hit(policy, "a@x.com")).ok).toBe(true)
})

test("different keys do not affect each other", async () => {
    const { make } = setup()
    const l = make()
    for (let i = 0; i < 4; i++) await l.hit(policy, "a@x.com")
    expect((await l.hit(policy, "b@x.com")).ok).toBe(true)
})

test("clear forgets the key in both layers", async () => {
    const { make } = setup()
    const l = make()
    for (let i = 0; i < 4; i++) await l.hit(policy, "a@x.com")
    await l.clear(policy, "a@x.com")
    expect((await l.hit(policy, "a@x.com")).ok).toBe(true)
})

test("fails open on memory alone when the shared store is down", async () => {
    const { shared } = setup()
    shared.fail = true
    let reported = 0
    const l = createLimiter({ shared, onSharedError: () => reported++ })
    for (let i = 0; i < 3; i++) expect((await l.hit(policy, "a@x.com")).ok).toBe(true)
    expect((await l.hit(policy, "a@x.com")).ok).toBe(false)
    expect(reported).toBe(3)
})

test("memory stays bounded", async () => {
    const l = createLimiter({ maxLocalKeys: 10 })
    for (let i = 0; i < 100; i++) await l.hit(policy, `k${i}`)
    expect(l.localSize()).toBeLessThanOrEqual(10)
})

test("stored keys are hashed and case-insensitive", () => {
    const k = storageKey(policy, "Person@Example.com")
    expect(k).toMatch(/^[0-9a-f]{64}$/)
    expect(k).not.toContain("example")
    expect(storageKey(policy, " person@example.COM ")).toBe(k)
    expect(storageKey({ ...policy, name: "other" }, "person@example.com")).not.toBe(k)
})

// ---- Sign-in style: check without counting, record only failures ---------------------------------------

test("check never counts: any number of checks leaves the budget untouched", async () => {
    const { make } = setup()
    const l = make()
    for (let i = 0; i < 20; i++) expect((await l.check(policy, "a@x.com")).ok).toBe(true)
})

test("only recorded failures use up the budget, then even a check is refused", async () => {
    const { make } = setup()
    const l = make()
    for (let i = 0; i < 3; i++) {
        expect((await l.check(policy, "a@x.com")).ok).toBe(true)
        await l.record(policy, "a@x.com")
    }
    const r = await l.check(policy, "a@x.com")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.retryAfterSec).toBe(60)
})

test("a success in between clears the failures", async () => {
    const { make } = setup()
    const l = make()
    await l.record(policy, "a@x.com")
    await l.record(policy, "a@x.com")
    await l.clear(policy, "a@x.com")
    await l.record(policy, "a@x.com")
    expect((await l.check(policy, "a@x.com")).ok).toBe(true)
})

test("failures recorded on one instance are seen by another instance's check", async () => {
    const { make } = setup()
    const one = make()
    const two = make()
    for (let i = 0; i < 3; i++) await one.record(policy, "a@x.com")
    expect((await two.check(policy, "a@x.com")).ok).toBe(false)
})

test("a block ends with its window, as measured by the shared store, not by a date", async () => {
    const { clock, make } = setup()
    const l = make()
    for (let i = 0; i < 3; i++) await l.record(policy, "a@x.com")
    expect((await l.check(policy, "a@x.com")).ok).toBe(false)
    clock.t += 60_001
    expect((await l.check(policy, "a@x.com")).ok).toBe(true)
})

test("deleting the shared rows by hand does not lift a block this server already remembers; a restart does", async () => {
    const { shared, make } = setup()
    const l = make()
    for (let i = 0; i < 3; i++) await l.record(policy, "a@x.com")
    shared.rows.clear() // someone deleted the rows in Prisma Studio
    expect((await l.check(policy, "a@x.com")).ok).toBe(false) // L1 still holds the block until its window ends
    expect((await make().check(policy, "a@x.com")).ok).toBe(true) // a restarted server has no memory of it
})

test("check fails open on memory alone when the shared store is down", async () => {
    const { shared } = setup()
    shared.fail = true
    const l = createLimiter({ shared, onSharedError: () => { } })
    for (let i = 0; i < 3; i++) await l.record(policy, "a@x.com")
    expect((await l.check(policy, "a@x.com")).ok).toBe(false)
    expect((await l.check(policy, "other@x.com")).ok).toBe(true)
})

test("policies are sane and the sign-in code maps to a message", () => {
    for (const p of Object.values(RATE)) {
        expect(p.limit).toBeGreaterThan(0)
        expect(p.windowMs).toBeGreaterThan(0)
    }
    expect(RATE.loginEmail.limit).toBeLessThan(RATE.loginIp.limit)
    expect(messageForRateLimitCode(RATE_LIMITED_CODE)).toMatch(/too many/i)
    expect(messageForRateLimitCode("account_banned")).toBeNull()
})
