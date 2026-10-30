// lib/contact.ts
// The Contact page: what a visitor may send, how much of it, and the statuses the team moves it through.
// Pure (unit tested); app/api/contact/route.ts does the database part.
import { parseEmail } from "../auth/email-input"

export const CONTACT_TOPICS = [
    { value: "ACCOUNT", label: "Help with my account" },
    { value: "SHOP", label: "My shop or business" },
    { value: "LISTING", label: "A wrong price, address or listing" },
    { value: "PRIVACY", label: "My personal information" },
    { value: "PARTNER", label: "Partnership or press" },
    { value: "OTHER", label: "Something else" },
] as const

export type ContactTopicValue = (typeof CONTACT_TOPICS)[number]["value"]

export const topicLabel = (v: string) => CONTACT_TOPICS.find((t) => t.value === v)?.label ?? v

export const NAME_MAX = 100
export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 2000

export type ContactInput = { name: string; email: string; topic: ContactTopicValue; message: string }

export type ParsedContact =
    | { ok: true; value: ContactInput }
    | { ok: false; error: string }
    /** The hidden field was filled in: a robot. The route answers as if it worked and stores nothing. */
    | { ok: false; spam: true }

/** Collapse runs of spaces and blank lines but keep the line breaks a person typed. */
function tidyMessage(raw: string): string {
    return raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

export function parseContactInput(body: unknown): ParsedContact {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>

    // A hidden field people never see; a robot fills every field it finds
    if (typeof b.website === "string" && b.website.trim() !== "") return { ok: false, spam: true }

    const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : ""
    if (name.length < 2) return { ok: false, error: "Tell us your name" }
    if (name.length > NAME_MAX) return { ok: false, error: `The name is too long (${NAME_MAX} characters at most)` }

    const email = parseEmail(b.email)
    if (!email.ok) return { ok: false, error: email.error }

    const topic = CONTACT_TOPICS.find((t) => t.value === b.topic)
    if (!topic) return { ok: false, error: "Choose what your message is about" }

    const message = typeof b.message === "string" ? tidyMessage(b.message) : ""
    if (message.length < MESSAGE_MIN) return { ok: false, error: `Write a little more (at least ${MESSAGE_MIN} characters)` }
    if (message.length > MESSAGE_MAX) return { ok: false, error: `The message is too long (${MESSAGE_MAX} characters at most)` }

    return { ok: true, value: { name, email: email.value, topic: topic.value, message } }
}

export const RATE_LIMIT = { perHour: 3, perDay: 10 } as const

/** How many messages this sender (same email or same address) already sent. */
export function checkRate(sent: { lastHour: number; lastDay: number }): { ok: true } | { ok: false; error: string } {
    if (sent.lastHour >= RATE_LIMIT.perHour || sent.lastDay >= RATE_LIMIT.perDay) {
        return { ok: false, error: "You have sent several messages already. Please wait a while before writing again." }
    }
    return { ok: true }
}

// ---- The team's side ----

export const CONTACT_STATUSES = ["NEW", "READ", "HANDLED"] as const
export type ContactStatusValue = (typeof CONTACT_STATUSES)[number]

export const CONTACT_STATUS_LABEL: Record<ContactStatusValue, string> = { NEW: "New", READ: "Read", HANDLED: "Handled" }

export const isContactStatus = (v: unknown): v is ContactStatusValue =>
    typeof v === "string" && (CONTACT_STATUSES as readonly string[]).includes(v)

/** What the team can do to a message in this status (any status can go to any other, except staying put). */
export function contactMoves(status: ContactStatusValue): { to: ContactStatusValue; label: string }[] {
    if (status === "NEW") return [{ to: "READ", label: "Mark as read" }, { to: "HANDLED", label: "Mark as handled" }]
    if (status === "READ") return [{ to: "HANDLED", label: "Mark as handled" }, { to: "NEW", label: "Mark as new" }]
    return [{ to: "NEW", label: "Reopen" }]
}

/** The mailto link the team uses to answer. */
export function replyHref(m: { email: string; topic: string }): string {
    return `mailto:${m.email}?subject=${encodeURIComponent(`Bayna: ${topicLabel(m.topic)}`)}`
}

export const CONTACT_PAGE_SIZES = [10, 25, 50] as const
export const DEFAULT_CONTACT_PAGE_SIZE = 25

export type ContactQuery = { status: "all" | ContactStatusValue; page: number; pageSize: number }

type Raw = Record<string, string | string[] | undefined>

/** The inbox filter and page from the address; anything odd falls back to the defaults (New first). */
export function parseContactQuery(raw: Raw): ContactQuery {
    const one = (k: string) => (Array.isArray(raw[k]) ? raw[k]![0] : (raw[k] as string | undefined))
    const s = one("status")
    const status = s === "all" ? "all" : isContactStatus(s?.toUpperCase()) ? (s!.toUpperCase() as ContactStatusValue) : "NEW"
    const page = Math.max(1, Math.floor(Number(one("page"))) || 1)
    const size = Number(one("pageSize"))
    const pageSize = (CONTACT_PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_CONTACT_PAGE_SIZE
    return { status, page, pageSize }
}

export function buildContactHref(q: ContactQuery, change: Partial<ContactQuery> = {}): string {
    const next = { ...q, ...change }
    // Changing the filter or the size goes back to the first page
    if (("status" in change || "pageSize" in change) && !("page" in change)) next.page = 1
    const p = new URLSearchParams()
    if (next.status !== "NEW") p.set("status", next.status === "all" ? "all" : next.status.toLowerCase())
    if (next.page > 1) p.set("page", String(next.page))
    if (next.pageSize !== DEFAULT_CONTACT_PAGE_SIZE) p.set("pageSize", String(next.pageSize))
    const qs = p.toString()
    return qs ? `/admin/messages?${qs}` : "/admin/messages"
}
