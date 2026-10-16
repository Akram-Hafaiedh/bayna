"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import ProviderProfileForm, { EMPTY_PROFILE, type ProfileValues } from "@/components/provider/ProviderProfileForm"

function toValues(p: Record<string, unknown>): ProfileValues {
    const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "")
    const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null)
    return {
        businessName: s("businessName"),
        description: s("description"),
        phone: s("phone"),
        whatsapp: s("whatsapp"),
        address: s("address"),
        city: s("city"),
        governorate: s("governorate"),
        latitude: n("latitude"),
        longitude: n("longitude"),
        locationSource: typeof p.locationSource === "string" ? p.locationSource : null,
    }
}

type AppStatus = "loading" | "none" | "pending" | "approved"

export default function BecomeProviderPage() {
    const { data: session } = useSession()
    const [appStatus, setAppStatus] = useState<AppStatus>("loading")
    const [application, setApplication] = useState<ProfileValues | null>(null)
    const [version, setVersion] = useState(0)
    const [message, setMessage] = useState("")
    const [withdrawing, setWithdrawing] = useState(false)

    const role = session?.user?.role

    useEffect(() => {
        async function loadStatus() {
            try {
                const res = await fetch("/api/provider/apply")
                const data = await res.json()
                if (data.status === "pending") {
                    setApplication(toValues(data.provider))
                    setAppStatus("pending")
                }
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

    // Create the application, or save changes to a pending one
    async function save(body: Record<string, unknown>): Promise<string | null> {
        setMessage("")
        const pending = appStatus === "pending"
        const res = await fetch("/api/provider/apply", {
            method: pending ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) return data.error || "Application failed"

        if (pending) {
            setApplication(toValues(data.provider))
            setVersion((x) => x + 1)
            setMessage("Application updated.")
        } else {
            // Load what was saved, so the pending view shows the real values
            const again = await (await fetch("/api/provider/apply")).json()
            if (again.provider) setApplication(toValues(again.provider))
            setAppStatus("pending")
            setMessage("Application submitted.")
        }
        return null
    }

    async function withdraw() {
        if (!confirm("Withdraw your application? You can apply again later.")) return
        setWithdrawing(true)
        try {
            const res = await fetch("/api/provider/apply", { method: "DELETE" })
            if (res.ok) {
                setApplication(null)
                setMessage("")
                setVersion((x) => x + 1)
                setAppStatus("none")
            } else {
                const data = await res.json()
                setMessage(data.error || "Could not withdraw")
            }
        } finally {
            setWithdrawing(false)
        }
    }

    const pending = appStatus === "pending"

    return (
        <div className="max-w-3xl space-y-6">
            {pending ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-6">
                    <h1 className="text-xl font-semibold text-amber-900">Application pending</h1>
                    <p className="mt-2 text-sm text-amber-800">
                        Your application is waiting for admin approval. You can still correct your details below, or withdraw it.
                        You will get provider access once it is approved.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={withdraw}
                            disabled={withdrawing}
                            className="h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            {withdrawing ? "Withdrawing..." : "Withdraw application"}
                        </button>
                        <Link
                            href="/profile"
                            className="inline-flex h-10 items-center rounded-lg border border-amber-200 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-50"
                        >
                            Back to profile
                        </Link>
                    </div>
                </div>
            ) : (
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Become a provider</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Submit your shop details. An admin will review and approve your application before you can list products.
                    </p>
                </div>
            )}

            {message && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{message}</div>
            )}

            <ProviderProfileForm
                key={version}
                initial={application ?? EMPTY_PROFILE}
                submitLabel={pending ? "Save changes" : "Submit application"}
                onSubmit={save}
            />
        </div>
    )
}
