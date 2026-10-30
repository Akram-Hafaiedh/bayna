// lib/admin/impersonation.ts
// "View as": a platform staff member sees the app as another person. Pure (unit tested). The database side is
// lib/admin/impersonation-session.ts; the routes are /api/admin/impersonation/start and /end.
//
//   - Read-only for now: while a session is open every request that could change something is refused, in the
//     proxy (the method check below), in the guards and in withAudit. Write mode is reserved, not built.
//   - Who can be viewed: an active account that is not staff, and not the person asking.
//   - One open session per admin; it lasts DEFAULT_MINUTES (the hard cap is MAX_MINUTES).
//   - The page is drawn for the viewed person (auth.ts swaps the session user), every log row names the real admin.
//   - A cookie (VIEW_AS_COOKIE) tells the proxy, which has no database, which role to route by and that writes
//     are off. It only ever restricts: a forged one cannot give anyone access to anything. It carries its own end
//     time, so the proxy stops obeying it when the time is up. It is readable by the page (not httpOnly) so the
//     banner can clear one that outlived its session (see ViewAsBanner).

export const DEFAULT_MINUTES = 30
export const MAX_MINUTES = 120
export const VIEW_AS_COOKIE = "bayna-view-as"
export const START_PATH = "/api/admin/impersonation/start"
export const END_PATH = "/api/admin/impersonation/end"

export const REASON_MIN = 10
export const REASON_MAX = 300

export const READ_ONLY_MESSAGE =
    "You are viewing another account in read-only mode, so nothing can be changed. Exit to go back to your own account."

export type ImpersonationMode = "READ_ONLY" | "WRITE"

/** What the session carries to the pages, the guards and the banner. */
export type ViewAs = {
    id: string
    mode: ImpersonationMode
    expiresAt: string
    adminId: string
    adminName: string
    targetName: string
}

export type StartRequest = { userId: string; reason: string; password: string }

export function parseStart(body: unknown): { ok: true; value: StartRequest } | { ok: false; error: string } {
    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const userId = typeof b.userId === "string" ? b.userId.trim() : ""
    if (!userId) return { ok: false, error: "Choose the account to view" }
    const reason = typeof b.reason === "string" ? b.reason.trim().replace(/\s+/g, " ") : ""
    if (reason.length < REASON_MIN) return { ok: false, error: "Say why you need to view this account (a few words, for the record)" }
    if (reason.length > REASON_MAX) return { ok: false, error: `The reason is too long (${REASON_MAX} characters at most)` }
    const password = typeof b.password === "string" ? b.password : ""
    if (!password) return { ok: false, error: "Enter your password to confirm" }
    return { ok: true, value: { userId, reason, password } }
}

export type TargetInfo = {
    id: string
    status: string
    role: string
    deletedAt: Date | null
    /** holds a role at the platform level (staff) */
    hasPlatformRole: boolean
}

/** May this admin start viewing as this account? */
export function checkTarget(adminId: string, target: TargetInfo): { ok: true } | { ok: false; error: string } {
    if (target.id === adminId) return { ok: false, error: "You cannot view as yourself" }
    if (target.deletedAt || target.status !== "ACTIVE") {
        return { ok: false, error: "Only an active account can be viewed. A suspended or closing account is read on its user page." }
    }
    if (target.role === "ADMIN" || target.hasPlatformRole) return { ok: false, error: "Staff accounts cannot be viewed as" }
    return { ok: true }
}

/** When a session started `now` ends. */
export const expiryFor = (now: Date, minutes: number = DEFAULT_MINUTES) =>
    new Date(now.getTime() + Math.min(minutes, MAX_MINUTES) * 60_000)

export const isOpen = (s: { endedAt: Date | null; expiresAt: Date }, now: Date = new Date()) =>
    s.endedAt === null && s.expiresAt.getTime() > now.getTime()

/** "12:05" or "0:42": the time left, for the banner. */
export function timeLeft(expiresAt: Date | string, now: Date = new Date()): string {
    const ms = Math.max(0, new Date(expiresAt).getTime() - now.getTime())
    const total = Math.ceil(ms / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

// --- the cookie the proxy reads -------------------------------------------------------------------------------

export type ViewAsCookie = { mode: ImpersonationMode; role: "CLIENT" | "COMPANY"; expiresAt: number }

/** "ro.CLIENT.1793000000000": mode, role of the viewed person, and when the session ends (ms since 1970). */
export const viewAsCookieValue = (mode: ImpersonationMode, role: string, expiresAt: Date) =>
    `${mode === "WRITE" ? "rw" : "ro"}.${role}.${expiresAt.getTime()}`

/** The cookie's content, or null when it is missing, malformed or past its end time. */
export function parseViewAsCookie(value: string | null | undefined, now: Date = new Date()): ViewAsCookie | null {
    const m = /^(ro|rw)\.(CLIENT|COMPANY)\.(\d{10,15})$/.exec(value ?? "")
    if (!m) return null
    const expiresAt = Number(m[3])
    if (expiresAt <= now.getTime()) return null
    return { mode: m[1] === "rw" ? "WRITE" : "READ_ONLY", role: m[2] as "CLIENT" | "COMPANY", expiresAt }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * The proxy's rule: while a read-only session is open, only reading is allowed. Sign-out and the Exit button
 * stay open. Returns the refusal, or null to let the request through.
 */
export function viewAsBlock(method: string, pathname: string, cookie: ViewAsCookie | null): { status: 403; error: string } | null {
    if (!cookie || cookie.mode !== "READ_ONLY") return null
    if (SAFE_METHODS.has(method.toUpperCase())) return null
    if (pathname === END_PATH || pathname.startsWith("/api/auth/")) return null
    return { status: 403, error: READ_ONLY_MESSAGE }
}

/** Where to land after the session starts: the viewed person's own home. */
export const homeForViewedRole = (role: string) => (role === "COMPANY" ? "/shop" : "/dashboard")
