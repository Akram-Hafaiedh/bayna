import Navbar from "@/components/Navbar"

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen flex flex-col bg-zinc-50">
            <Navbar />
            <main className="flex-1">{children}</main>
        </div>
    )
}