import Navbar from "@/components/Navbar"

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen flex flex-col bg-zinc-50">
            <Navbar />
            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-8">{children}</div>
            </main>
        </div>
    )
}