// lib/access/role-list.ts
// What the roles list screen does with its rows: filter, sort and summarise. Pure (unit tested), so the
// client component only draws what comes out.
import { groupPermissions } from "./role-view"
import { moduleTitle } from "./permission-labels"

export type RoleListItem = {
    id: string
    name: string
    description: string | null
    permissions: string[]
    members: number
    invites: number
    /** this person may edit, clone or delete it */
    editable: boolean
    /** who owns the role: a business or one shop */
    owner: { scope: "BUSINESS" | "SHOP"; id: string; name: string }
}

export type RoleFilters = {
    /** matches the name, the description and the module names */
    q: string
    /** "all", or the id of an owner (a business or a shop) */
    owner: string
    access: "all" | "everything" | "limited"
    usage: "all" | "used" | "unused"
    sort: "name" | "people" | "access"
}

export const NO_FILTERS: RoleFilters = { q: "", owner: "all", access: "all", usage: "all", sort: "name" }

export const holdsEverything = (permissions: readonly string[]) => permissions.includes("*")

/** Modules a role reaches, in plain words, in the order of the permission catalogue: ["Products", "Orders"]. */
export function roleModules(permissions: readonly string[]): string[] {
    return groupPermissions(permissions).map((g) => moduleTitle(g.module))
}

/** "Everything", "No access", or "3 modules, 12 permissions". */
export function accessLabel(permissions: readonly string[]): string {
    if (holdsEverything(permissions)) return "Everything"
    if (permissions.length === 0) return "No permissions"
    const modules = roleModules(permissions).length
    return `${modules} ${modules === 1 ? "module" : "modules"}, ${permissions.length} ${permissions.length === 1 ? "permission" : "permissions"}`
}

const text = (r: RoleListItem) =>
    [r.name, r.description ?? "", r.owner.name, ...(holdsEverything(r.permissions) ? ["everything"] : roleModules(r.permissions))].join(" ").toLowerCase()

export function filterRoles(items: readonly RoleListItem[], f: RoleFilters): RoleListItem[] {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    const out = items.filter((r) => {
        if (f.owner !== "all" && r.owner.id !== f.owner) return false
        if (f.access === "everything" && !holdsEverything(r.permissions)) return false
        if (f.access === "limited" && holdsEverything(r.permissions)) return false
        const used = r.members + r.invites > 0
        if (f.usage === "used" && !used) return false
        if (f.usage === "unused" && used) return false
        if (words.length) {
            const haystack = text(r)
            if (!words.every((w) => haystack.includes(w))) return false
        }
        return true
    })
    const byName = (a: RoleListItem, b: RoleListItem) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    // "Everything" counts as more access than any list of keys
    const size = (r: RoleListItem) => (holdsEverything(r.permissions) ? Number.MAX_SAFE_INTEGER : r.permissions.length)
    if (f.sort === "people") return out.sort((a, b) => b.members - a.members || byName(a, b))
    if (f.sort === "access") return out.sort((a, b) => size(b) - size(a) || byName(a, b))
    return out.sort(byName)
}

export const isFiltered = (f: RoleFilters) =>
    f.q.trim() !== "" || f.owner !== "all" || f.access !== "all" || f.usage !== "all"
