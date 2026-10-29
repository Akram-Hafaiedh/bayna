import Navbar from "@/components/Navbar"
import { SubNav } from "@/components/DashboardShell"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <SubNav
                items={[
                    { href: "/admin/dashboard", label: "Overview" },
                    { href: "/admin/shops", label: "Shops" },
                    { href: "/admin/catalogue", label: "Catalogue" },
                    { href: "/admin/catalogue-requests", label: "Catalogue requests" },
                    { href: "/admin/categories", label: "Categories" },
                    { href: "/admin/users", label: "Users" },
                    { href: "/admin/staff", label: "Staff" },
                    { href: "/admin/impersonation", label: "View as" },
                    { href: "/admin/messages", label: "Messages" },
                ]}
            />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}
