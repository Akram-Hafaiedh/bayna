
// lib/user-list.ts
// The users list of the admin area: the row shape, the search / filter / page query that lives in the URL,
// and the database filter built from it. Pure (unit tested); lib/admin-users.ts runs the query.
import type { Prisma } from "@/app/generated/prisma/client"
import { USER_STATUSES, type UserStatusValue } from "./user-status"

export type UserRow = {
    id: string
    email: string
    name: string | null
    phone: string | null
    role: string
    status: UserStatusValue
    suspendedReason: string | null
    createdAt: string
    providers: { id: string; name: string; status: string }[]
}

export const USER_ROLES = ["CLIENT", "PROVIDER", "ADMIN"] as const
export const USER_PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_USER_PAGE_SIZE = 25

export type UserQuery = {
    q: string
    role: "all" | (typeof USER_ROLES)[number]
    status: "all" | UserStatusValue
    page: number
    pageSize: number
}

export const NO_USER_QUERY: UserQuery = { q: "", role: "all", status: "all", page: 1, pageSize: DEFAULT_USER_PAGE_SIZE }

type Raw = URLSearchParams | Record<string, string | string[] | undefined>

function pick(raw: Raw, key: string): string | undefined {
    if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined
    const v = raw[key]
    return Array.isArray(v) ? v[0] : v
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback
}

function positiveInt(value: string | undefined, fallback: number): number {
    const n = Number.parseInt(value ?? "", 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Reads the address (or the page's searchParams); anything unknown falls back to the default. */
export function parseUserQuery(raw: Raw): UserQuery {
    const size = positiveInt(pick(raw, "pageSize"), DEFAULT_USER_PAGE_SIZE)
    return {
        q: (pick(raw, "q") ?? "").trim().slice(0, 100),
        role: oneOf(pick(raw, "role"), ["all", ...USER_ROLES] as const, "all"),
        status: oneOf(pick(raw, "status"), ["all", ...USER_STATUSES] as const, "all"),
        page: positiveInt(pick(raw, "page"), 1),
        pageSize: (USER_PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_USER_PAGE_SIZE,
    }
}

/** A query-only link for the same page. Changing anything except `page` goes back to page 1; defaults are left out. */
export function buildUsersHref(current: UserQuery, overrides: Partial<UserQuery> = {}): string {
    const next: UserQuery = { ...current, ...overrides }
    if (!("page" in overrides)) next.page = 1
    const p = new URLSearchParams()
    if (next.q) p.set("q", next.q)
    if (next.role !== "all") p.set("role", next.role)
    if (next.status !== "all") p.set("status", next.status)
    if (next.page > 1) p.set("page", String(next.page))
    if (next.pageSize !== DEFAULT_USER_PAGE_SIZE) p.set("pageSize", String(next.pageSize))
    return `?${p.toString()}`
}

export const hasUserFilters = (q: UserQuery) => q.q !== "" || q.role !== "all" || q.status !== "all"

/** Every word must match the name, email, phone or the name of one of the person's shops. */
export function userWhere(query: UserQuery): Prisma.UserWhereInput {
    const words = query.q.split(/\s+/).filter(Boolean)
    return {
        deletedAt: null,
        ...(query.role !== "all" ? { role: query.role } : {}),
        ...(query.status !== "all" ? { status: query.status } : {}),
        AND: words.map((w) => ({
            OR: [
                { name: { contains: w, mode: "insensitive" as const } },
                { email: { contains: w, mode: "insensitive" as const } },
                { phone: { contains: w, mode: "insensitive" as const } },
                { providers: { some: { deletedAt: null, name: { contains: w, mode: "insensitive" as const } } } },
            ],
        })),
    }
}
