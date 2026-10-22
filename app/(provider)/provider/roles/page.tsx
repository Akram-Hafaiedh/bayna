import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { auth } from "@/auth"
import { requireProvider } from "@/lib/provider-auth"
import { prisma } from "@/lib/prisma"
import { loadAccess } from "@/lib/access/load"
import { ALL_BUSINESS_KEYS, ALL_SHOP_KEYS } from "@/lib/access/catalogue"
import { effective, has } from "@/lib/access/evaluate"
import { loadRoleRows } from "@/lib/access/roles-data"
import RolesManager from "@/components/access/RolesManager"

export const metadata: Metadata = { title: "Roles" }

export default function ProviderRolesPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <RolesContent />
            </Suspense>
        </div>
    )
}

async function RolesContent() {
    await connection()
    const shop = await requireProvider()
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    if (!shop?.isVerified || !access) {
        return (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The roles page opens once your shop is approved.
            </p>
        )
    }

    const found = await prisma.shop.findUnique({
        where: { id: shop.id },
        select: { name: true, businessId: true, business: { select: { id: true, name: true, deletedAt: true } } },
    })
    const business = found?.business && !found.business.deletedAt ? found.business : null

    const eff = effective(access.assignments, { providerId: shop.id, businessId: business?.id ?? null })
    const can = (k: string) => has(eff, k)
    if (!can("team.role.view")) {
        return (
            <>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    You do not have access to the roles. Ask an owner or manager.
                </p>
            </>
        )
    }
    const canManage = can("team.role.manage")
    const shopKeys = [...ALL_SHOP_KEYS]

    const [rows, bizRows] = await Promise.all([
        loadRoleRows({ scope: "SHOP", providerId: shop.id }, can, canManage),
        // roles of the business can be given here too: listed for reference, changed in the Business area
        business ? loadRoleRows({ scope: "BUSINESS", businessId: business.id }, () => false, false) : Promise.resolve([]),
    ])

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    What each role in {found?.name ?? "this shop"} can do. Roles are given from the{" "}
                    <Link href="/provider/team" className="underline underline-offset-2 hover:text-zinc-900">Team page</Link>.
                </p>
            </div>

            <RolesManager
                scope="SHOP"
                targetId={shop.id}
                title={`Roles of ${found?.name ?? "this shop"}`}
                note="Owned by this shop. They can only be given in this shop."
                roles={rows}
                keys={shopKeys}
                grantable={shopKeys.filter(can)}
                canEverything={eff.all}
                canManage={canManage}
            />

            {business && bizRows.length > 0 && (
                <RolesManager
                    scope="BUSINESS"
                    targetId={business.id}
                    title={`Roles of ${business.name} (business)`}
                    note="Owned by the business. They can be given here too, but only the business changes them."
                    roles={bizRows}
                    keys={[...ALL_BUSINESS_KEYS]}
                    grantable={[]}
                    canEverything={false}
                    canManage={false}
                />
            )}
        </>
    )
}
