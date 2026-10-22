import { Suspense } from "react"
import type { Metadata } from "next"
import { loadBusinessRolesContext } from "@/lib/access/role-pages"
import RoleNewContent from "@/components/access/RoleNewContent"

export const metadata: Metadata = { title: "New role" }

export default function NewBusinessRolePage({ searchParams }: { searchParams: Promise<{ clone?: string; for?: string }> }) {
    return (
        <div className="max-w-5xl">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <NewRoleContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function NewRoleContent({ searchParams }: { searchParams: Promise<{ clone?: string; for?: string }> }) {
    const { clone, for: forOwner } = await searchParams
    const { access, business, owners } = await loadBusinessRolesContext()
    return (
        <RoleNewContent
            access={access}
            owners={owners}
            cloneId={typeof clone === "string" ? clone : undefined}
            preferOwnerId={typeof forOwner === "string" ? forOwner : business.id}
            backHref="/business/roles"
            teamHref="/business/team"
        />
    )
}
