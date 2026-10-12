import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Role } from "@/app/generated/prisma/enums"
import { connection } from "next/server"

async function Year() {
    "use cache"
    return <>{new Date().getFullYear()}</>
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={<AuthShell>{children}</AuthShell>}>
            <AuthGate>{children}</AuthGate>
        </Suspense>
    )
}

async function AuthGate({ children }: { children: React.ReactNode }) {
    await connection()
    const session = await auth()

    if (session?.user?.id) {
        const role = session.user.role as Role
        if (role === Role.ADMIN) redirect("/admin/dashboard")
        if (role === Role.PROVIDER) redirect("/provider/dashboard")
        redirect("/dashboard")
    }

    return <AuthShell>{children}</AuthShell>
}

function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex">
            <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white flex-col justify-between p-12 relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                        backgroundSize: "48px 48px",
                    }}
                />
                <div className="relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold text-sm">
                            B
                        </div>
                        <span className="text-xl font-semibold tracking-tight">
                            Bayna
                        </span>
                    </div>
                </div>
                <div className="relative z-10 space-y-6 max-w-md">
                    <h1 className="text-4xl font-semibold leading-tight tracking-tight">
                        Find the best price.
                        <br />
                        <span className="text-zinc-400">
                            Know if it&apos;s worth the trip.
                        </span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                        Compare real prices from local shops across Tunisia,
                        including travel cost — so you always make the smart
                        choice.
                    </p>
                </div>
                <div className="relative z-10 text-sm text-zinc-500">
                    ©{" "}
                    <Suspense fallback={null}>
                        <Year />
                    </Suspense>{" "}
                    Bayna · Tunisia
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-zinc-50 px-6 py-12">
                <div className="w-full max-w-[400px]">{children}</div>
            </div>
        </div>
    )
}