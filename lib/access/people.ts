// lib/access/people.ts
// "Everyone in the business": one line per person with their role in the business and in each shop,
// built from the assignments of the business and of its shops. Pure (unit tested).

export type PersonRow = {
    userId: string
    name: string | null
    email: string
    roleName: string
    /** null = a business-level role; otherwise the shop this role is for */
    shop: { id: string; name: string } | null
    suspended: boolean
    accountClosed: boolean
}

export type PersonSummary = {
    userId: string
    name: string | null
    email: string
    businessRole: string | null
    shopRoles: { shopId: string; shopName: string; roleName: string; suspended: boolean }[]
    suspendedInBusiness: boolean
    accountClosed: boolean
}

export function groupPeople(rows: readonly PersonRow[]): PersonSummary[] {
    const byUser = new Map<string, PersonSummary>()
    for (const r of rows) {
        const p =
            byUser.get(r.userId) ??
            { userId: r.userId, name: r.name, email: r.email, businessRole: null, shopRoles: [], suspendedInBusiness: false, accountClosed: r.accountClosed }
        if (r.shop) p.shopRoles.push({ shopId: r.shop.id, shopName: r.shop.name, roleName: r.roleName, suspended: r.suspended })
        else {
            p.businessRole = r.roleName
            p.suspendedInBusiness = r.suspended
        }
        byUser.set(r.userId, p)
    }
    const people = [...byUser.values()]
    for (const p of people) p.shopRoles.sort((a, b) => a.shopName.localeCompare(b.shopName) || a.shopId.localeCompare(b.shopId))
    // people with a business-level role first, then by name
    return people.sort(
        (a, b) =>
            Number(b.businessRole !== null) - Number(a.businessRole !== null) ||
            (a.name ?? a.email).localeCompare(b.name ?? b.email) ||
            a.userId.localeCompare(b.userId)
    )
}
