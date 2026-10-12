"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"

export default function Navbar() {
    const { data: session, status } = useSession()
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
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
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-xs font-bold text-white">
                        B
                    </div>
                    <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
                        Bayna
                    </span>
                </Link>

                {/* Right side */}
                <div className="flex items-center gap-3">
                    {status === "loading" ? (
                        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />
                    ) : user ? (
                        /* Logged in — avatar + dropdown */
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen((v) => !v)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white ring-2 ring-white transition hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                                aria-label="User menu"
                            >
                                {initials}
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg ring-1 ring-black/5">
                                    <div className="border-b border-zinc-100 px-3.5 py-2.5">
                                        <p className="truncate text-sm font-medium text-zinc-900">
                                            {user.name || "User"}
                                        </p>
                                        <p className="truncate text-xs text-zinc-500">
                                            {user.email}
                                        </p>
                                        {user.role && (
                                            <span className="mt-1.5 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                                {user.role === "PROVIDER" ? "Provider" : "Buyer"}
                                            </span>
                                        )}
                                    </div>

                                    {user.role === "PROVIDER" && (
                                        <Link
                                            href="/dashboard"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                        >
                                            Dashboard
                                        </Link>
                                    )}

                                    <Link
                                        href="/profile"
                                        onClick={() => setMenuOpen(false)}
                                        className="block px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                    >
                                        Profile
                                    </Link>

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
                        /* Logged out — auth buttons */
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