import { Suspense } from "react"
import { requireRole } from "@/lib/session"
import { Role } from "@/app/generated/prisma/enums"
import Navbar from "@/components/Navbar"
import { DashboardLoading, SubNav } from "@/components/DashboardShell"

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <ClientAuth>{children}</ClientAuth>
        </Suspense>
    )
}

async function ClientAuth({ children }: { children: React.ReactNode }) {
    await requireRole([Role.CLIENT])

    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav items={[{ href: "/dashboard", label: "Overview" }]} />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}