// lib/activity-format.ts
// Turns an ActivityLog row into a readable line for the shop activity page. Pure (unit tested).
// Rows written by the audit triggers say "UPDATE Product [{ field, from, to }]"; rows written by
// logActivity() with a note (team changes) already read like a sentence.

export type ActivityRow = {
    entityType: string
    entityId: string | null
    action: string
    changes: unknown
    note: string | null
}

export type ActivityLine = {
    title: string
    /** the first few changed fields, "price: 12 → 14" */
    detail: string | null
    /** where to look at the thing that changed, when there is such a page */
    href: string | null
}

export type ActivityKind = "all" | "products" | "shop" | "team"

export const ACTIVITY_KINDS: { key: ActivityKind; label: string }[] = [
    { key: "all", label: "Everything" },
    { key: "products", label: "Products" },
    { key: "shop", label: "Shop profile" },
    { key: "team", label: "Team" },
]

export function parseKind(v: string | undefined | null): ActivityKind {
    return ACTIVITY_KINDS.some((k) => k.key === v) ? (v as ActivityKind) : "all"
}

/**
 * The part of the query that depends on the filter. The raw trigger rows of invitations and
 * assignments are left out of "Everything": the team routes write a readable row for each action,
 * and the invitation rows would only show a hashed token.
 */
export function kindFilter(kind: ActivityKind): Record<string, unknown> {
    switch (kind) {
        case "products": return { entityType: "Product" }
        case "shop": return { entityType: "Provider" }
        case "team": return { action: { startsWith: "TEAM_" } }
        default:
            return {
                NOT: {
                    entityType: { in: ["AccessInvite", "AccessAssignment", "AccessRole"] },
                    action: { in: ["CREATE", "UPDATE", "DELETE"] },
                },
            }
    }
}

const ENTITY: Record<string, string> = {
    User: "the account",
    Product: "a product",
    Provider: "the shop profile",
    Business: "the business details",
    AccessAssignment: "a team member",
    AccessInvite: "an invitation",
    AccessRole: "a role",
    CatalogSuggestion: "a catalogue suggestion",
}

const VERB: Record<string, string> = {
    CREATE: "Added",
    UPDATE: "Changed",
    DELETE: "Deleted",
    SOFT_DELETE: "Moved to trash:",
    RESTORE: "Restored",
}

// Fields that change on every write and say nothing useful
const NOISE = new Set(["updatedAt", "tokenHash"])

const short = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "empty"
    const t = typeof v === "string" ? v : JSON.stringify(v)
    return t.length > 40 ? t.slice(0, 37) + "..." : t
}

type Change = { field: string; from: unknown; to: unknown }

function readChanges(raw: unknown): Change[] {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((c) =>
        c && typeof c === "object" && typeof (c as Change).field === "string" ? [c as Change] : []
    )
}

/**
 * One readable line for an activity row. `shopBase` is the shop's address ("/shop/<publicShopId>") when the line is
 * shown inside that shop; the links to its pages need it. Without it (the Business page lists several
 * shops) those links are left out.
 */
export function describeActivity(row: ActivityRow, shopBase: string | null = null): ActivityLine {
    const changes = readChanges(row.changes).filter((c) => !NOISE.has(c.field))
    const what = ENTITY[row.entityType] ?? row.entityType
    const title = row.note?.trim() || `${VERB[row.action] ?? row.action} ${what}`

    // For a new row every field goes from nothing to something: list the names only
    const detail =
        row.action === "CREATE"
            ? null
            : changes.length === 0
                ? null
                : changes
                    .slice(0, 3)
                    .map((c) => `${c.field}: ${short(c.from)} → ${short(c.to)}`)
                    .join(", ") + (changes.length > 3 ? `, and ${changes.length - 3} more` : "")

    const inShop = (section: string) => (shopBase ? `${shopBase}/${section}` : null)
    let href: string | null = null
    if (row.entityType === "Product" && row.entityId) {
        href = row.action === "SOFT_DELETE" ? inShop("products/trash") : row.action === "DELETE" ? null : inShop(`products/${row.entityId}/edit`)
    } else if (row.entityType === "Provider") {
        href = inShop("profile")
    } else if (row.entityType === "Business") {
        href = "/business/profile"
    } else if (row.action.startsWith("TEAM_ROLE_")) {
        href = inShop("roles")
    } else if (row.action.startsWith("TEAM_")) {
        href = inShop("team")
    }
    return { title, detail, href }
}
