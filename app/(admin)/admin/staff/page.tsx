import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"
import { platformCan } from "@/lib/access/page"
import { loadStaffPage } from "@/lib/admin-staff"
import { Role } from "@/app/generated/prisma/enums"
import StaffList from "@/components/admin/StaffList"

export const metadata: Metadata = { title: "Staff" }

export default function AdminStaffPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Staff</h1>
                <p className="mt-1 text-sm text-zinc-500">The people who work for Bayna, and what each of them may do</p>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <StaffContent />
            </Suspense>
        </div>
    )
}

async function StaffContent() {
    await connection()
    const me = await requireRole([Role.ADMIN])
    const perms = await platformCan(["access.assignment.view", "access.assignment.grant", "access.assignment.revoke"] as const)
    if (!perms["access.assignment.view"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the staff list.</p>
    }
    const { members, invites, roles } = await loadStaffPage(me.id ?? "")
    return (
        <StaffList
            members={members}
            invites={invites}
            roles={roles}
            canGrant={perms["access.assignment.grant"]}
            canRevoke={perms["access.assignment.revoke"]}
        />
    )
}
