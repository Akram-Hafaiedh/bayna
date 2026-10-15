// lib/access/match.ts
// Pattern matching used only when system roles are written in code and expanded into explicit keys.
// Stored roles never contain patterns (except "*" on SUPER_ADMIN), so a permission added to the
// catalogue later is never granted to an existing role by accident.
//
// Pattern segments are separated by dots. "*" matches exactly one segment, except as the last
// segment, where it matches the rest. "*" alone matches everything.
//   "catalog.*"        every catalog key (catalog.item.view, catalog.category.reorder, ...)
//   "access.*.view"    access.role.view, access.assignment.view
//   "shop.provider.*"  every action on shop.provider

export function matchesPattern(pattern: string, key: string): boolean {
    if (pattern === "*") return true
    const p = pattern.split(".")
    const k = key.split(".")
    for (let i = 0; i < p.length; i++) {
        if (p[i] === "*") {
            if (i === p.length - 1) return k.length > i // trailing * needs at least one segment left
            if (k.length <= i) return false
            continue
        }
        if (p[i] !== k[i]) return false
    }
    return k.length === p.length
}

/** Every catalogue key matching any include pattern and no exclude pattern. */
export function expandPatterns(
    all: readonly string[],
    include: readonly string[],
    exclude: readonly string[] = []
): string[] {
    return all.filter(
        (key) => include.some((p) => matchesPattern(p, key)) && !exclude.some((p) => matchesPattern(p, key))
    )
}
