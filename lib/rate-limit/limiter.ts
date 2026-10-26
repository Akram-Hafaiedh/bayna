// lib/rate-limit/limiter.ts
// Two layers, because a server that runs as many short-lived instances (Vercel) cannot count in memory alone:
//   L1  memory of this instance. Free and instant. A key already over its limit is refused here without
//       touching the database, so an attacker hammering one instance costs almost nothing.
//   L2  a shared store (Postgres, see db-store.ts). Every instance reads and writes the same counter, so the
//       limit holds across instances. It is the one that decides; L1 only saves trips to it.
// If L2 is down the limiter keeps working on L1 alone (it fails open: a database problem must not lock
// every user out of signing in).
//
// Time: the shared store answers "how long until this window ends" (retryMs) instead of a date, and L1 adds
// that to its own clock. So the database's clock and time zone never leak into a decision here.
//
// Three ways to count:
//   hit     count a try and refuse the (limit + 1)th. For actions where every try counts (register, reset).
//   check   look without counting: refused once `limit` tries are already on record.
//   record  count a try without judging it.
//   Sign-in uses check, then record only for a FAILED password, so good sign-ins never use up the budget.
import { createHash } from "node:crypto"
import type { RatePolicy } from "./policies"

/** `retryMs`: time left in the current window, by the store's own clock. */
export type HitResult = { count: number; retryMs: number }

/** The shared layer. `hit` adds one try and returns the new count; it must be atomic. */
export interface SharedStore {
    hit(key: string, windowMs: number): Promise<HitResult>
    /** The live window for a key without counting, or null when there is none (never counted, or expired). */
    peek(key: string): Promise<HitResult | null>
    clear(key: string): Promise<void>
}

export type RateResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number }

type Slot = { count: number; resetAt: number }

export type LimiterOptions = {
    shared?: SharedStore
    now?: () => number
    /** Keys kept in memory at most; expired ones are dropped first when it is full. */
    maxLocalKeys?: number
    onSharedError?: (error: unknown) => void
}

/** The stored key never holds the raw email or IP. */
export function storageKey(policy: RatePolicy, subject: string): string {
    return createHash("sha256").update(`${policy.name}\n${subject.trim().toLowerCase()}`).digest("hex")
}

const blocked = (retryMs: number): RateResult => ({ ok: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) })

export function createLimiter(options: LimiterOptions = {}) {
    const now = options.now ?? Date.now
    const max = options.maxLocalKeys ?? 5000
    const local = new Map<string, Slot>()

    function sweep(at: number) {
        for (const [k, s] of local) if (s.resetAt <= at) local.delete(k)
        // Still full of live keys: drop the oldest ones so memory stays bounded
        while (local.size >= max) {
            const first = local.keys().next().value
            if (first === undefined) break
            local.delete(first)
        }
    }

    function remember(key: string, slot: Slot, at: number) {
        if (!local.has(key) && local.size >= max) sweep(at)
        local.set(key, slot)
    }

    const live = (key: string, at: number) => {
        const s = local.get(key)
        return s && s.resetAt > at ? s : undefined
    }

    /** Count one try in L1, then in L2. `refuseInMemory` lets `hit` skip the database for a key already over. */
    async function count(policy: RatePolicy, subject: string, judge: boolean): Promise<RateResult> {
        const key = storageKey(policy, subject)
        const at = now()

        const slot = live(key, at) ?? { count: 0, resetAt: at + policy.windowMs }
        slot.count += 1
        remember(key, slot, at)
        if (judge && slot.count > policy.limit) return blocked(slot.resetAt - at)

        if (options.shared) {
            try {
                const shared = await options.shared.hit(key, policy.windowMs)
                // Take the shared view into memory, so the next over-limit try is refused by L1 alone
                remember(key, { count: shared.count, resetAt: at + shared.retryMs }, at)
                if (judge && shared.count > policy.limit) return blocked(shared.retryMs)
                return { ok: true, remaining: Math.max(0, policy.limit - shared.count) }
            } catch (error) {
                options.onSharedError?.(error)
            }
        }
        return { ok: true, remaining: Math.max(0, policy.limit - slot.count) }
    }

    const hit = (policy: RatePolicy, subject: string) => count(policy, subject, true)

    async function record(policy: RatePolicy, subject: string): Promise<void> {
        await count(policy, subject, false)
    }

    async function check(policy: RatePolicy, subject: string): Promise<RateResult> {
        const key = storageKey(policy, subject)
        const at = now()
        const slot = live(key, at)
        if (slot && slot.count >= policy.limit) return blocked(slot.resetAt - at)

        if (options.shared) {
            try {
                const shared = await options.shared.peek(key)
                if (shared) {
                    remember(key, { count: shared.count, resetAt: at + shared.retryMs }, at)
                    if (shared.count >= policy.limit) return blocked(shared.retryMs)
                    return { ok: true, remaining: policy.limit - shared.count }
                }
                // The shared store has no live window: a leftover local count is stale (expired or deleted)
                local.delete(key)
                return { ok: true, remaining: policy.limit }
            } catch (error) {
                options.onSharedError?.(error)
            }
        }
        return { ok: true, remaining: Math.max(0, policy.limit - (slot?.count ?? 0)) }
    }

    /** Forget a key in both layers (for example after a successful sign-in). */
    async function clear(policy: RatePolicy, subject: string): Promise<void> {
        const key = storageKey(policy, subject)
        local.delete(key)
        if (options.shared) {
            try {
                await options.shared.clear(key)
            } catch (error) {
                options.onSharedError?.(error)
            }
        }
    }

    return { hit, check, record, clear, localSize: () => local.size }
}
