"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

const GOVERNORATES = [
    "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan",
    "Bizerte", "Béja", "Jendouba", "Kef", "Siliana", "Sousse",
    "Monastir", "Mahdia", "Sfax", "Kairouan", "Kasserine", "Sidi Bouzid",
    "Gabès", "Medenine", "Tataouine", "Gafsa", "Tozeur", "Kebili",
]

type AppStatus = "loading" | "none" | "pending" | "approved"

export default function BecomeProviderPage() {
    const { data: session } = useSession()
    const [appStatus, setAppStatus] = useState<AppStatus>("loading")
    const [form, setForm] = useState({
        businessName: "",
        description: "",
        phone: "",
        address: "",
        city: "",
        governorate: "",
    })
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const role = session?.user?.role

    useEffect(() => {
        async function loadStatus() {
            try {
                const res = await fetch("/api/provider/apply")
                const data = await res.json()
                if (data.status === "pending") setAppStatus("pending")
                else if (data.status === "approved") setAppStatus("approved")
                else setAppStatus("none")
            } catch {
                setAppStatus("none")
            }
        }
        if (session?.user) loadStatus()
    }, [session])

    if (role === "ADMIN") {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                <h1 className="text-xl font-semibold text-zinc-900">
                    Admin accounts cannot become providers
                </h1>
                <Link
                    href="/admin/dashboard"
                    className="mt-6 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Go to admin dashboard
                </Link>
            </div>
        )
    }

    if (role === "PROVIDER" || appStatus === "approved") {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                <h1 className="text-xl font-semibold text-zinc-900">
                    You are a provider
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                    Manage your shop from the provider dashboard.
                </p>
                <Link
                    href="/provider/dashboard"
                    className="mt-6 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Go to provider dashboard
                </Link>
            </div>
        )
    }

    if (appStatus === "loading") {
        return <p className="text-sm text-zinc-500">Loading...</p>
    }

    if (appStatus === "pending") {
        return (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-8 text-center">
                <h1 className="text-xl font-semibold text-amber-900">
                    Application pending
                </h1>
                <p className="mt-2 text-sm text-amber-800">
                    Your provider application is waiting for admin approval.
                    You will get provider access once it is approved.
                </p>
                <Link
                    href="/profile"
                    className="mt-6 inline-flex h-10 items-center rounded-lg border border-amber-200 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-50"
                >
                    Back to profile
                </Link>
            </div>
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/api/provider/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Application failed")
                return
            }

            setAppStatus("pending")
        } catch {
            setError("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Become a provider
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Submit your shop details. An admin will review and approve
                    your application before you can list products.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5"
            >
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">
                        Business name <span className="text-red-500">*</span>
                    </label>
                    <input
                        required
                        type="text"
                        placeholder="e.g. Auto Parts Sousse"
                        value={form.businessName}
                        onChange={(e) =>
                            setForm({ ...form, businessName: e.target.value })
                        }
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">
                        Description
                    </label>
                    <textarea
                        rows={3}
                        placeholder="What do you sell?"
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">
                        Phone
                    </label>
                    <input
                        type="tel"
                        placeholder="+216 ..."
                        value={form.phone}
                        onChange={(e) =>
                            setForm({ ...form, phone: e.target.value })
                        }
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">
                        Address
                    </label>
                    <input
                        type="text"
                        placeholder="Street, building..."
                        value={form.address}
                        onChange={(e) =>
                            setForm({ ...form, address: e.target.value })
                        }
                        className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            City <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="e.g. Sousse"
                            value={form.city}
                            onChange={(e) =>
                                setForm({ ...form, city: e.target.value })
                            }
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            Governorate
                        </label>
                        <select
                            value={form.governorate}
                            onChange={(e) =>
                                setForm({ ...form, governorate: e.target.value })
                            }
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        >
                            <option value="">Select...</option>
                            {GOVERNORATES.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="h-11 px-5 rounded-lg bg-zinc-900 text-white text-[15px] font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Submitting..." : "Submit application"}
                    </button>
                    <Link
                        href="/profile"
                        className="text-sm text-zinc-500 hover:text-zinc-900"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    )
}