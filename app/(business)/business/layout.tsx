import { Suspense } from "react"
import Navbar from "@/components/Navbar"
import { SubNav } from "@/components/DashboardShell"
import BusinessSwitcherLoader from "@/components/business/BusinessSwitcherLoader"

// The Business area: the company behind the shops. Separate from the shop dashboard on purpose:
// the shop switcher stays about shops, this picker is about businesses.
export default function BusinessLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav
                leading={
                    <Suspense fallback={<div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-100" />}>
                        <BusinessSwitcherLoader />
                    </Suspense>
                }
                items={[
                    { href: "/business/profile", label: "Profile" },
                    { href: "/business/shops", label: "Shops" },
                    { href: "/business/team", label: "Team" },
                    { href: "/provider/dashboard", label: "Back to my shop" },
                ]}
            />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}
