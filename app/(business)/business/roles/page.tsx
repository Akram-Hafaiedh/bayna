import { Suspense } from "react"
import type { Metadata } from "next"
import { loadBusinessRolesContext, loadRoleItems } from "@/lib/access/role-pages"
import RolesList from "@/components/access/RolesList"

export const metadata: Metadata = { title: "Roles" }

export default function BusinessRolesPage() {
    return (
        <div className="max-w-4xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <RolesContent />
            </Suspense>
        </div>
    )
}

async function RolesContent() {
    const { owners } = await loadBusinessRolesContext()
    if (!owners.some((o) => o.canView)) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the roles. Ask the business owner.</p>
    }
    const items = await loadRoleItems(owners)
    const canCreate = owners.some((o) => o.canManage)

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    What each role can do. Roles are given from the Team page. A business role can be given for the whole business or for one of its shops; a shop role only works in its own shop.
                </p>
            </div>
            <RolesList
                items={items}
                basePath="/business/roles"
                canCreate={canCreate}
            />
        </>
    )
}
