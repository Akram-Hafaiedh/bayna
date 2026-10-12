import Navbar from "@/components/Navbar"
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