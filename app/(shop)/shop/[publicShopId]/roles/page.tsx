import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { loadRoleItems, loadShopRolesContext } from "@/lib/access/role-pages"
import RolesList from "@/components/access/RolesList"

export const metadata: Metadata = { title: "Roles" }

export default function ShopRolesPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <div className="max-w-4xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <RolesContent params={params} />
            </Suspense>
        </div>
    )
}

async function RolesContent({ params }: { params: Promise<{ publicShopId: string }> }) {
    await connection()
    const { publicShopId } = await params
    const ctx = await loadShopRolesContext(publicShopId)
    if (!ctx.ready) {
        return ctx.reason === "not-approved" ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">The roles page opens once your shop is approved.</p>
        ) : (
            <>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the roles. Ask an owner or manager.</p>
            </>
        )
    }

    const items = await loadRoleItems(ctx.owners)
    const canCreate = ctx.owners.some((o) => o.canManage)

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    What each role in {ctx.shop.name} can do. Roles are given from the{" "}
                    <Link href={`${ctx.shop.base}/team`} className="underline underline-offset-2 hover:text-zinc-900">Team page</Link>. Roles of the business can be given here too, but only the business changes them.
                </p>
            </div>
            <RolesList
                items={items}
                basePath={`${ctx.shop.base}/roles`}
                canCreate={canCreate}
            />
        </>
    )
}
