import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { loadShopRolesContext } from "@/lib/access/role-pages"
import RoleNewContent from "@/components/access/RoleNewContent"

export const metadata: Metadata = { title: "New role" }

export default function NewRolePage({ params, searchParams }: { params: Promise<{ publicShopId: string }>; searchParams: Promise<{ clone?: string }> }) {
    return (
        <div className="max-w-5xl">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <NewRoleContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function NewRoleContent({ params, searchParams }: { params: Promise<{ publicShopId: string }>; searchParams: Promise<{ clone?: string }> }) {
    await connection()
    const { publicShopId } = await params
    const { clone } = await searchParams
    const ctx = await loadShopRolesContext(publicShopId)
    if (!ctx.ready) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the roles.</p>
    }
    return (
        <RoleNewContent
            access={ctx.access}
            owners={ctx.owners}
            via={ctx.via}
            cloneId={typeof clone === "string" ? clone : undefined}
            preferOwnerId={ctx.shop.id}
            backHref={`${ctx.shop.base}/roles`}
            teamHref={`${ctx.shop.base}/team`}
        />
    )
}
