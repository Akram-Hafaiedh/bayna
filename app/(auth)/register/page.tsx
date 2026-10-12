"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
    const router = useRouter()
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
    })
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Registration failed")
                return
            }

            // After successful registration → go to login
            router.push("/login")
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
                    Create your account
                </h1>
                <p className="mt-2 text-zinc-500 text-[15px]">
                    Start comparing prices across Tunisia
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                    <label
                        htmlFor="name"
                        className="block text-sm font-medium text-zinc-700"
                    >
                        Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                </div>

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
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium text-zinc-700"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                            Creating account...
                        </span>
                    ) : (
                        "Create account"
                    )}
                </button>
            </form>

            <p className="mt-8 text-center text-sm text-zinc-500">
                Already have an account?{" "}
                <Link
                    href="/login"
                    className="font-medium text-zinc-900 hover:underline underline-offset-2"
                >
                    Log in
                </Link>
            </p>

            <p className="mt-4 text-center text-xs text-zinc-400">
                Want to sell on Bayna?{" "}
                <span className="text-zinc-500">
                    Create an account first, then apply to become a Provider.
                </span>
            </p>
        </div>
    )
}