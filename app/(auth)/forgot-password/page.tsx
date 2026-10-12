"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Something went wrong")
                return
            }

            setSuccess(true)
        } catch {
            setError("Something went wrong")
        } finally {
            setLoading(false)
        }
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
                    Forgot password?
                </h1>
                <p className="mt-2 text-zinc-500 text-[15px]">
                    Enter your email and we&apos;ll send you a reset link
                </p>
            </div>

            {success ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                    If an account exists with this email, a reset link has been sent.
                    <p className="mt-2 text-emerald-600/80 text-xs">
                        (In development the link is printed in the server console)
                    </p>
                </div>
            ) : (
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
                        {loading ? "Sending..." : "Send reset link"}
                    </button>
                </form>
            )}

            <p className="mt-8 text-center text-sm text-zinc-500">
                Remember your password?{" "}
                <Link
                    href="/login"
                    className="font-medium text-zinc-900 hover:underline underline-offset-2"
                >
                    Log in
                </Link>
            </p>
        </div>
    )
}