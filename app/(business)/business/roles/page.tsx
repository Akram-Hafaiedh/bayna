import { Suspense } from "react"
import type { Metadata } from "next"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { ALL_BUSINESS_KEYS, ALL_SHOP_KEYS } from "@/lib/access/catalogue"
import { effective, has } from "@/lib/access/evaluate"
import { loadRoleRows } from "@/lib/access/roles-data"
import RolesManager from "@/components/access/RolesManager"

export const metadata: Metadata = { title: "Roles" }

export default function BusinessRolesPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <RolesContent />
            </Suspense>
        </div>
    )
}

async function RolesContent() {
    const { business, access } = await requireBusinessArea()

    // What this person may do at the business, and in each shop (a business-level role reaches every shop)
    const bizEff = effective(access.assignments, { businessId: business.id })
    const canViewBusiness = has(bizEff, "business.role.view")
    const canManageBusiness = has(bizEff, "business.role.manage")

    const shops = await prisma.shop.findMany({
        where: { businessId: business.id, deletedAt: null, isVerified: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, city: true },
    })

    const businessKeys = [...ALL_BUSINESS_KEYS]
    const shopKeys = [...ALL_SHOP_KEYS]
    const sections = await Promise.all([
        canViewBusiness
            ? (async () => ({
                kind: "business" as const,
                rows: await loadRoleRows({ scope: "BUSINESS", businessId: business.id }, (k) => has(bizEff, k), canManageBusiness),
            }))()
            : Promise.resolve(null),
        ...shops.map(async (shop) => {
            const eff = effective(access.assignments, { providerId: shop.id, businessId: business.id })
            if (!has(eff, "team.role.view")) return null
            const manage = has(eff, "team.role.manage")
            return {
                kind: "shop" as const,
                shop,
                eff,
                manage,
                rows: await loadRoleRows({ scope: "SHOP", providerId: shop.id }, (k) => has(eff, k), manage),
            }
        }),
    ])
    const biz = sections[0]
    const shopSections = sections.slice(1).flatMap((s) => (s && s.kind === "shop" ? [s] : []))

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    What each role can do. Roles are given from the Team page. A business role can be given for the whole business or for one of its shops; a shop role only works in its own shop.
                </p>
            </div>

            {biz && (
                <RolesManager
                    scope="BUSINESS"
                    targetId={business.id}
                    title={`Business roles of ${business.name}`}
                    note="Owned by the business. Their shop permissions work in every shop when the role is given for the whole business."
                    roles={biz.rows}
                    keys={businessKeys}
                    grantable={businessKeys.filter((k) => has(bizEff, k))}
                    canEverything={bizEff.all}
                    canManage={canManageBusiness}
                />
            )}

            {shopSections.map((s) => (
                <RolesManager
                    key={s.shop.id}
                    scope="SHOP"
                    targetId={s.shop.id}
                    title={`Roles of ${s.shop.name}`}
                    note="Owned by this shop. Can only be given in this shop."
                    roles={s.rows}
                    keys={shopKeys}
                    grantable={shopKeys.filter((k) => has(s.eff, k))}
                    canEverything={s.eff.all}
                    canManage={s.manage}
                />
            ))}

            {!biz && shopSections.length === 0 && (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the roles. Ask the business owner.</p>
            )}
        </>
    )
}
