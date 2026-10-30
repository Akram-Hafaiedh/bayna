"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { readAuthReturn } from "@/lib/auth/auth-return"
import { messageForSignInCode } from "@/lib/users/user-status"
import { messageForRateLimitCode } from "@/lib/rate-limit/policies"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    // An invitation link brings the address it was sent to
    useEffect(() => {
        const { email } = readAuthReturn(window.location.search)
        if (email) setEmail((e) => e || email)
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setLoading(true)

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        })

        setLoading(false)

        if (result?.error) {
            // A suspended or closed account says so (only after the right password); anything else is generic
            const code = (result as { code?: unknown }).code
            setError(messageForSignInCode(code) ?? messageForRateLimitCode(code) ?? "Invalid email or password")
            return
        }

        // Come back to where they were going (for example an invitation link), else home
        router.push(readAuthReturn(window.location.search).next ?? "/")
        router.refresh()
    }

    return (
        <div>
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 mb-10">
                <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-sm">
                    B
                </div>
                <span className="text-xl font-semibold tracking-tight text-zinc-900">
                    Bayna
                </span>
            </div>

            <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Welcome back
                </h1>
                <p className="mt-2 text-zinc-500 text-[15px]">
                    Log in to your Bayna account
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                    <label
                        htmlFor="email"
                        className="block text-sm font-medium text-zinc-700"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-zinc-700"
                        >
                            Password
                        </label>
                        <Link
                            href="/forgot-password"
                            className="text-sm text-zinc-500 hover:text-zinc-900"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-lg bg-zinc-900 text-white text-[15px] font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {loading ? (
                        <span className="inline-flex items-center gap-2">
                            <svg
                                className="animate-spin h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            Logging in...
                        </span>
                    ) : (
                        "Log in"
                    )}
                </button>
            </form>

            <p className="mt-8 text-center text-sm text-zinc-500">
                Don&apos;t have an account?{" "}
                <Link
                    href="/register"
                    className="font-medium text-zinc-900 hover:underline underline-offset-2"
                >
                    Create one
                </Link>
            </p>
        </div>
    )
}