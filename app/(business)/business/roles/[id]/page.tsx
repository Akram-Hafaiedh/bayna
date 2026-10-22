import { Suspense } from "react"
import type { Metadata } from "next"
import { loadBusinessRolesContext } from "@/lib/access/role-pages"
import RoleEditContent from "@/components/access/RoleEditContent"

export const metadata: Metadata = { title: "Role" }

export default function BusinessRolePage({ params }: { params: Promise<{ id: string }> }) {
    return (
        <div className="max-w-5xl">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <RoleContent params={params} />
            </Suspense>
        </div>
    )
}

async function RoleContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { access } = await loadBusinessRolesContext()
    return <RoleEditContent access={access} roleId={id} backHref="/business/roles" teamHref="/business/team" />
}
