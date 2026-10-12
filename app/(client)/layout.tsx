import Navbar from "@/components/Navbar"
import { SubNav } from "@/components/DashboardShell"

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav items={[{ href: "/dashboard", label: "Overview" }]} />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}