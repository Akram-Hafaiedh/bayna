// lib/impersonation-list.ts
// The "View as" sessions list of the admin area: reading the address, the open / ended rule, and the wording.
// Pure (unit tested). The database read is lib/admin-impersonation.ts.
import type { Prisma } from "@/app/generated/prisma/client"

export const SESSION_STATES = ["all", "open", "ended"] as const
export type SessionState = (typeof SESSION_STATES)[number]
export const SESSION_PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_SESSION_PAGE_SIZE = 25

export type SessionQuery = { state: SessionState; page: number; pageSize: number }
export const NO_SESSION_QUERY: SessionQuery = { state: "all", page: 1, pageSize: DEFAULT_SESSION_PAGE_SIZE }

type Raw = URLSearchParams | Record<string, string | string[] | undefined>

function pick(raw: Raw, key: string): string | undefined {
    if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined
    const v = raw[key]
    return Array.isArray(v) ? v[0] : v
}

function positiveInt(value: string | undefined, fallback: number): number {
    const n = Number.parseInt(value ?? "", 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}

export function parseSessionQuery(raw: Raw): SessionQuery {
    const state = pick(raw, "state")
    const size = positiveInt(pick(raw, "pageSize"), DEFAULT_SESSION_PAGE_SIZE)
    return {
        state: (SESSION_STATES as readonly string[]).includes(state ?? "") ? (state as SessionState) : "all",
        page: positiveInt(pick(raw, "page"), 1),
        pageSize: (SESSION_PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_SESSION_PAGE_SIZE,
    }
}

/** A query-only link for the same page. Changing anything except `page` goes back to page 1; defaults are left out. */
export function buildSessionsHref(current: SessionQuery, overrides: Partial<SessionQuery> = {}): string {
    const next: SessionQuery = { ...current, ...overrides }
    if (!("page" in overrides)) next.page = 1
    const p = new URLSearchParams()
    if (next.state !== "all") p.set("state", next.state)
    if (next.page > 1) p.set("page", String(next.page))
    if (next.pageSize !== DEFAULT_SESSION_PAGE_SIZE) p.set("pageSize", String(next.pageSize))
    return `?${p.toString()}`
}

export type SessionTimes = { endedAt: Date | string | null; expiresAt: Date | string }

/** A session is open until someone ends it or its time is up; both count as ended. */
export function isSessionOpen(s: SessionTimes, now: Date = new Date()): boolean {
    return s.endedAt === null && new Date(s.expiresAt).getTime() > now.getTime()
}

export function sessionWhere(query: SessionQuery, now: Date = new Date()): Prisma.ImpersonationSessionWhereInput {
    if (query.state === "open") return { endedAt: null, expiresAt: { gt: now } }
    if (query.state === "ended") return { OR: [{ endedAt: { not: null } }, { expiresAt: { lte: now } }] }
    return {}
}

/** How a session ended, in words. `endedBy` is ADMIN, EXPIRED, SIGNED_OUT or STAFF; a session never closed but past its time ran out. */
export function endedLabel(s: SessionTimes & { endedBy: string | null }, now: Date = new Date()): string {
    if (isSessionOpen(s, now)) return "Open"
    switch (s.endedBy) {
        case "ADMIN": return "Ended by the staff member"
        case "SIGNED_OUT": return "Staff member signed out"
        case "STAFF": return "Ended by another staff member"
        case "EXPIRED": return "Time ran out"
        default: return "Time ran out"
    }
}
