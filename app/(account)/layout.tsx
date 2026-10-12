import { Suspense } from "react"
import { requireAuth } from "@/lib/session"
import Navbar from "@/components/Navbar"
import { DashboardLoading } from "@/components/DashboardShell"

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <AccountAuth>{children}</AccountAuth>
        </Suspense>
    )
}

async function AccountAuth({ children }: { children: React.ReactNode }) {
    await requireAuth()

    return (
        <div className="min-h-screen flex flex-col bg-zinc-50">
            <Navbar />
            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-8">{children}</div>
            </main>
        </div>
    )
}