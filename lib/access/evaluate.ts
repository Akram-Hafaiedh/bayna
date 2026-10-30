// lib/access/evaluate.ts
// Decides whether someone may do something, from their assignments. Pure: no database, no session.
//
// Rules
//   - default deny
//   - effective permissions = the union of the permissions of the person's live roles. There are no
//     per-person grants or denies: to change what someone can do, change or swap their role
//   - only ACTIVE, unexpired assignments count (expiresAt makes access time-boxed)
//   - every role works the same way: nothing here looks at a role's name, only at its permissions
//   - a check that names a shop looks at that shop's own assignments and at the business-level
//     assignments of the business the shop belongs to (a business owner is an owner in every shop of
//     the business). A check that names only a business looks at that business's assignments. One that
//     names neither looks only at platform assignments. Nothing ever reaches another shop or business
//   - nobody can hand out a key they do not hold themselves (ungrantable)

export type AssignmentInput = {
    scope: "PLATFORM" | "BUSINESS" | "SHOP"
    shopId: string | null
    /** The business, for BUSINESS scope. Optional so shop and platform rows need not carry it. */
    businessId?: string | null
    status: "INVITED" | "ACTIVE" | "SUSPENDED"
    expiresAt: Date | null
    role: { name: string; permissions: string[] }
}

export type CheckContext = {
    /** The shop the action targets. Leave out for platform-level actions. */
    shopId?: string | null
    /** The business that shop belongs to (or the business itself for business-level actions). */
    businessId?: string | null
}

export type Effective = {
    /** true when a held "*" applies ("everything") */
    all: boolean
    allow: ReadonlySet<string>
}

export function isLive(a: AssignmentInput, now: Date): boolean {
    return a.status === "ACTIVE" && (a.expiresAt === null || a.expiresAt.getTime() > now.getTime())
}

export function applies(a: AssignmentInput, ctx: CheckContext): boolean {
    if (ctx.shopId) {
        if (a.scope === "SHOP" && a.shopId === ctx.shopId) return true
        // inherited from the business, only when the context says which business the shop is in
        return a.scope === "BUSINESS" && !!ctx.businessId && a.businessId === ctx.businessId
    }
    if (ctx.businessId) return a.scope === "BUSINESS" && a.businessId === ctx.businessId
    return a.scope === "PLATFORM"
}

export function effective(
    assignments: readonly AssignmentInput[],
    ctx: CheckContext = {},
    now: Date = new Date()
): Effective {
    const allow = new Set<string>()
    let all = false
    for (const a of assignments) {
        if (!isLive(a, now) || !applies(a, ctx)) continue
        for (const k of a.role.permissions) {
            if (k === "*") all = true
            else allow.add(k)
        }
    }
    return { all, allow }
}

export function has(eff: Effective, key: string): boolean {
    return eff.all || eff.allow.has(key)
}

export function can(
    assignments: readonly AssignmentInput[],
    key: string,
    ctx: CheckContext = {},
    now: Date = new Date()
): boolean {
    return has(effective(assignments, ctx, now), key)
}

/** Every key the person holds in this context, for showing or exporting ("what can this user do?"). */
export function listAllowed(eff: Effective, catalogue: readonly string[]): string[] {
    return catalogue.filter((k) => has(eff, k))
}

/**
 * No privilege escalation: the actor may hand out only keys they hold themselves.
 * Returns the keys they may not give.
 */
export function ungrantable(actor: Effective, keys: readonly string[]): string[] {
    // handing out "*" needs "*"
    return keys.filter((k) => (k === "*" ? !actor.all : !has(actor, k)))
}

/** Names of the live roles that apply here, for labelling the actor in the audit log ("Admin", "Manager"). */
export function roleNames(
    assignments: readonly AssignmentInput[],
    ctx: CheckContext = {},
    now: Date = new Date()
): string[] {
    const names = assignments.filter((a) => isLive(a, now) && applies(a, ctx)).map((a) => a.role.name)
    return [...new Set(names)].sort()
}
