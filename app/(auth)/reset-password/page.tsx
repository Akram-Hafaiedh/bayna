"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        if (!token) {
            setError("Invalid reset link")
            return
        }

        setLoading(true)

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Something went wrong")
                return
            }

            setSuccess(true)
            setTimeout(() => router.push("/login"), 2000)
        } catch {
            setError("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    if (!token) {
        return (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                Invalid or missing reset token.{" "}
                <Link href="/forgot-password" className="underline">
                    Request a new one
                </Link>
            </div>
        )
    }

    return (
        <>
            {success ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                    Password updated successfully. Redirecting to login...
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-zinc-700"
                        >
                            New password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            minLength={6}
                            autoComplete="new-password"
                            placeholder="At least 6 characters"
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label
                            htmlFor="confirmPassword"
                            className="block text-sm font-medium text-zinc-700"
                        >
                            Confirm new password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            minLength={6}
                            autoComplete="new-password"
                            placeholder="Repeat your password"
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {loading ? "Updating..." : "Update password"}
                    </button>
                </form>
            )}
        </>
    )
}

export default function ResetPasswordPage() {
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
                    Reset your password
                </h1>
                <p className="mt-2 text-zinc-500 text-[15px]">
                    Enter your new password below
                </p>
            </div>

            <Suspense fallback={<div className="text-sm text-zinc-500">Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>

            <p className="mt-8 text-center text-sm text-zinc-500">
                <Link
                    href="/login"
                    className="font-medium text-zinc-900 hover:underline underline-offset-2"
                >
                    Back to login
                </Link>
            </p>
        </div>
    )
}