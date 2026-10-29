import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { loadShopRolesContext } from "@/lib/access/role-pages"
import RoleEditContent from "@/components/access/RoleEditContent"

export const metadata: Metadata = { title: "Role" }

export default function RolePage({ params }: { params: Promise<{ publicShopId: string; id: string }> }) {
    return (
        <div className="max-w-5xl">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <RoleContent params={params} />
            </Suspense>
        </div>
    )
}

async function RoleContent({ params }: { params: Promise<{ publicShopId: string; id: string }> }) {
    await connection()
    const { publicShopId, id } = await params
    const ctx = await loadShopRolesContext(publicShopId)
    if (!ctx.ready) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the roles.</p>
    }
    return <RoleEditContent access={ctx.access} roleId={id} via={ctx.via} backHref={`${ctx.shop.base}/roles`} teamHref={`${ctx.shop.base}/team`} />
}
