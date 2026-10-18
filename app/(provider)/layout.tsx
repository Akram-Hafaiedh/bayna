import { Suspense } from "react"
import Navbar from "@/components/Navbar"
import ShopSwitcherLoader from "@/components/provider/ShopSwitcherLoader"
import { SubNav } from "@/components/DashboardShell"

export default function ProviderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav
                leading={
                    <Suspense fallback={<div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-100" />}>
                        <ShopSwitcherLoader />
                    </Suspense>
                }
                items={[
                    { href: "/provider/dashboard", label: "Overview" },
                    { href: "/provider/products", label: "Products" },
                    { href: "/provider/profile", label: "Profile" },
                ]}
            />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}