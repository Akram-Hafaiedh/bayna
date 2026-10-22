// lib/access/team-filter.ts
// Search and filters of the team list. Pure (unit tested).
export type MemberFilterInput = {
    name: string | null
    email: string
    roleId: string
    roleName: string
    status: "ACTIVE" | "SUSPENDED" | "INVITED"
    accountClosed: boolean
}

export type MemberFilters = {
    q: string
    /** "all" or a role id */
    roleId: string
    status: "all" | "active" | "suspended"
}

export const NO_MEMBER_FILTERS: MemberFilters = { q: "", roleId: "all", status: "all" }

export function filterMembers<T extends MemberFilterInput>(members: readonly T[], f: MemberFilters): T[] {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    return members.filter((m) => {
        if (f.roleId !== "all" && m.roleId !== f.roleId) return false
        if (f.status === "suspended" && m.status !== "SUSPENDED") return false
        if (f.status === "active" && (m.status === "SUSPENDED" || m.accountClosed)) return false
        if (words.length) {
            const haystack = `${m.name ?? ""} ${m.email} ${m.roleName}`.toLowerCase()
            if (!words.every((w) => haystack.includes(w))) return false
        }
        return true
    })
}

/** Up to two letters for the round avatar: "Ben Salah" -> "BS", "ben@x.tn" -> "B". */
export function initials(name: string | null, email: string): string {
    const source = (name ?? "").trim()
    if (source) {
        const parts = source.split(/\s+/).filter(Boolean)
        return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
    }
    return (email.trim()[0] ?? "?").toUpperCase()
}
