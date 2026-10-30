// lib/businesses/business-choice.ts
// Which business does a new shop go into? Pure (unit tested).
//
// `allowed` are the businesses the person may add a shop to (they hold business.shop.create there).
// `requested` is what the form sent: a business id, "new" for a separate business, or nothing.
export type BusinessChoice =
    | { ok: true; kind: "existing"; businessId: string }
    | { ok: true; kind: "new" }
    | { ok: false; error: string }

export function resolveBusinessChoice(allowed: readonly string[], requested: unknown): BusinessChoice {
    const asked = typeof requested === "string" ? requested.trim() : ""

    if (asked === "new") return { ok: true, kind: "new" }
    if (asked) {
        return allowed.includes(asked)
            ? { ok: true, kind: "existing", businessId: asked }
            : { ok: false, error: "You cannot add a shop to that business" }
    }
    // Nothing chosen: a first application starts a business; one business is the obvious home
    if (allowed.length === 0) return { ok: true, kind: "new" }
    if (allowed.length === 1) return { ok: true, kind: "existing", businessId: allowed[0] }
    return { ok: false, error: "Choose which business the new shop belongs to" }
}
