"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"

type Role = "CLIENT" | "PROVIDER" | "ADMIN"

function getDashboardHref(role?: string) {
    if (role === "ADMIN") return "/admin/dashboard"
    if (role === "PROVIDER") return "/provider/dashboard"
    return "/dashboard"
}

function getRoleLabel(role?: string) {
    if (role === "ADMIN") return "Admin"
    if (role === "PROVIDER") return "Provider"
    return "Client"
}

function getRoleBadgeClass(role?: string) {
    if (role === "ADMIN") return "bg-violet-50 text-violet-700"
    if (role === "PROVIDER") return "bg-emerald-50 text-emerald-700"
    return "bg-zinc-100 text-zinc-600"
}

export default function Navbar() {
    const { data: session, status } = useSession()
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const user = session?.user
    const role = user?.role as Role | undefined
    const dashboardHref = getDashboardHref(role)

    const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : user?.email?.[0]?.toUpperCase() ?? "?"

    return (
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
                {/* Logo only on the left */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-xs font-bold text-white">
                        B
                    </div>
                    <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
                        Bayna
                    </span>
                </Link>

                {/* Right side only */}
                <div className="flex items-center gap-3">
                    {status === "loading" ? (
                        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />
                    ) : user ? (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen((v) => !v)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white ring-2 ring-white transition hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                                aria-label="User menu"
                            >
                                {initials}
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg">
                                    <div className="px-3.5 py-2.5 border-b border-zinc-100">
                                        <p className="text-sm font-medium text-zinc-900 truncate">
                                            {user.name || "User"}
                                        </p>
                                        <p className="text-xs text-zinc-500 truncate">
                                            {user.email}
                                        </p>
                                        <span
                                            className={`mt-1.5 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${getRoleBadgeClass(role)}`}
                                        >
                                            {getRoleLabel(role)}
                                        </span>
                                    </div>

                                    <Link
                                        href={dashboardHref}
                                        onClick={() => setMenuOpen(false)}
                                        className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                    >
                                        Dashboard
                                    </Link>

                                    <Link
                                        href="/profile"
                                        onClick={() => setMenuOpen(false)}
                                        className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                    >
                                        Profile
                                    </Link>

                                    {role === "CLIENT" && (
                                        <Link
                                            href="/become-provider"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                        >
                                            Become a Provider
                                        </Link>
                                    )}

                                    {role === "PROVIDER" && (
                                        <>
                                            <Link
                                                href="/provider/products"
                                                onClick={() => setMenuOpen(false)}
                                                className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                            >
                                                My Products
                                            </Link>
                                            <Link
                                                href="/provider/orders"
                                                onClick={() => setMenuOpen(false)}
                                                className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                            >
                                                Orders
                                            </Link>
                                        </>
                                    )}

                                    {role === "ADMIN" && (
                                        <>
                                            <Link
                                                href="/admin/providers"
                                                onClick={() => setMenuOpen(false)}
                                                className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                            >
                                                Providers
                                            </Link>
                                            <Link
                                                href="/admin/users"
                                                onClick={() => setMenuOpen(false)}
                                                className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                            >
                                                Users
                                            </Link>
                                        </>
                                    )}

                                    <div className="my-1 border-t border-zinc-100" />

                                    <button
                                        onClick={() => {
                                            setMenuOpen(false)
                                            signOut({ callbackUrl: "/" })
                                        }}
                                        className="block w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                    >
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link
                                href="/login"
                                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/register"
                                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}