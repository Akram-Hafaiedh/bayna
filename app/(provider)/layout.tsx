import { Suspense } from "react"
import { requireRole } from "@/lib/session"
import { Role } from "@/app/generated/prisma/enums"
import Navbar from "@/components/Navbar"
import { DashboardLoading, SubNav } from "@/components/DashboardShell"

export default function ProviderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <ProviderAuth>{children}</ProviderAuth>
        </Suspense>
    )
}

async function ProviderAuth({ children }: { children: React.ReactNode }) {
    await requireRole([Role.PROVIDER])

    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav
                items={[
                    { href: "/provider/dashboard", label: "Overview" },
                    { href: "/provider/products", label: "Products" },
                    { href: "/provider/orders", label: "Orders" },
                ]}
            />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}