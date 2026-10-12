import { Suspense } from "react"
import { requireRole } from "@/lib/session"
import { Role } from "@/app/generated/prisma/enums"
import Navbar from "@/components/Navbar"
import { DashboardLoading, SubNav } from "@/components/DashboardShell"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <AdminAuth>{children}</AdminAuth>
        </Suspense>
    )
}

async function AdminAuth({ children }: { children: React.ReactNode }) {
    await requireRole([Role.ADMIN])

    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav
                items={[
                    { href: "/admin/dashboard", label: "Overview" },
                    { href: "/admin/providers", label: "Providers" },
                    { href: "/admin/users", label: "Users" },
                ]}
            />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}