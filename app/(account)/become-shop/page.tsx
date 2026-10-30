"use client"

import { useEffect, useState } from "react"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ShopProfileForm, { EMPTY_PROFILE, type ProfileValues } from "@/components/shop/ShopProfileForm"

function toValues(p: Record<string, unknown>): ProfileValues {
    const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "")
    const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null)
    return {
        name: s("name"),
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

type AppStatus = "loading" | "none" | "pending"

export default function BecomeShopPage() {
    const { data: session } = useSession()
    const [appStatus, setAppStatus] = useState<AppStatus>("loading")
    const [application, setApplication] = useState<ProfileValues | null>(null)
    const [version, setVersion] = useState(0)
    const [message, setMessage] = useState("")
    const [withdrawing, setWithdrawing] = useState(false)
    // Businesses a new shop could be added to, and which one is chosen ("new" = a separate business)
    const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([])
    const [businessChoice, setBusinessChoice] = useState("")
    // Name of the company, asked when this application starts a new business
    const [newBusinessName, setNewBusinessName] = useState("")
    const confirm = useConfirm()
    const toast = useToast()
    const router = useRouter()

    const role = session?.user?.role

    useEffect(() => {
        async function loadStatus() {
            try {
                const res = await fetch("/api/shop/apply")
                const data = await res.json()
                const options: { id: string; name: string }[] = Array.isArray(data.businesses) ? data.businesses : []
                setBusinesses(options)
                setBusinessChoice((c) => c || options[0]?.id || "")
                if (data.status === "pending") {
                    setApplication(toValues(data.shop))
                    setAppStatus("pending")
                } else if (options.length > 0) {
                    // Someone who runs a business adds a shop from the Business area, not from here
                    router.replace("/business/shops/new")
                } else setAppStatus("none")
            } catch {
                setAppStatus("none")
            }
        }
        if (session?.user) loadStatus()
    }, [session, router])

    if (role === "ADMIN") {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                <h1 className="text-xl font-semibold text-zinc-900">
                    Admin accounts cannot become shops
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

    if (appStatus === "loading") {
        return <p className="text-sm text-zinc-500">Loading...</p>
    }

    // Create the application, or save changes to a pending one
    async function save(body: Record<string, unknown>): Promise<string | null> {
        setMessage("")
        const pending = appStatus === "pending"
        // Only a new application picks a business (a waiting one keeps the one it has)
        const startsBusiness = !pending && (businesses.length === 0 || businessChoice === "new")
        const payload = {
            ...body,
            ...(!pending && businesses.length > 0 ? { businessId: businessChoice || businesses[0].id } : {}),
            ...(startsBusiness && newBusinessName.trim() ? { newBusinessName: newBusinessName.trim() } : {}),
        }
        const res = await fetch("/api/shop/apply", {
            method: pending ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) return data.error || "Application failed"

        if (pending) {
            setApplication(toValues(data.shop))
            setVersion((x) => x + 1)
            setMessage("Application updated.")
        } else {
            // Load what was saved, so the pending view shows the real values
            const again = await (await fetch("/api/shop/apply")).json()
            if (again.shop) setApplication(toValues(again.shop))
            setAppStatus("pending")
            setMessage("Application submitted.")
        }
        return null
    }

    async function withdraw() {
        const yes = await confirm({
            title: "Withdraw your application?",
            message: "Your shop details will be removed from the review queue. You can apply again later.",
            confirmLabel: "Withdraw",
            tone: "danger",
        })
        if (!yes) return
        setWithdrawing(true)
        try {
            const res = await fetch("/api/shop/apply", { method: "DELETE" })
            if (res.ok) {
                setApplication(null)
                setMessage("")
                setVersion((x) => x + 1)
                setAppStatus("none")
                toast.success("Application withdrawn", { description: "You can apply again whenever you like." })
            } else {
                const data = await res.json()
                setMessage(data.error || "Could not withdraw")
            }
        } finally {
            setWithdrawing(false)
        }
    }

    const pending = appStatus === "pending"
    // Already a company account: this page creates one more shop
    const another = role === "COMPANY"

    return (
        <div className="max-w-3xl space-y-6">
            {pending ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-6">
                    <h1 className="text-xl font-semibold text-amber-900">Application pending</h1>
                    <p className="mt-2 text-sm text-amber-800">
                        Your application is waiting for admin approval. You can still correct your details below, or withdraw it.
                        {another
                            ? " You will see the shop in your shop switcher once it is approved. Your other shops keep working."
                            : " You will get access to your shop dashboard once it is approved."}
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
                            href={another ? "/shop" : "/profile"}
                            className="inline-flex h-10 items-center rounded-lg border border-amber-200 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-50"
                        >
                            {another ? "Back to my shop" : "Back to profile"}
                        </Link>
                    </div>
                </div>
            ) : (
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                        {another ? "Create a new shop" : "Open your shop"}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        {another
                            ? "Add another shop to your account. An admin reviews it before you can list products. Your other shops keep working, and you switch between them from the shop menu."
                            : "Submit your shop details. An admin will review and approve your application before you can list products."}
                    </p>
                    {another && (
                        <Link href="/shop" className="mt-3 inline-block text-sm text-zinc-500 hover:text-zinc-900">
                            ← Back to my shop
                        </Link>
                    )}
                </div>
            )}

            {message && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{message}</div>
            )}

            {!pending && businesses.length > 0 && (
                <fieldset className="rounded-xl border border-zinc-200 bg-white p-6">
                    <legend className="px-1 text-base font-semibold text-zinc-900">Which business is this shop part of?</legend>
                    <p className="mt-1 text-sm text-zinc-500">
                        Shops of the same business share its owners, legal details and plan.
                    </p>
                    <div className="mt-3 space-y-2">
                        {businesses.map((b) => (
                            <label key={b.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-800">
                                <input
                                    type="radio"
                                    name="business"
                                    value={b.id}
                                    checked={businessChoice === b.id}
                                    onChange={() => setBusinessChoice(b.id)}
                                    className="h-4 w-4 accent-zinc-900"
                                />
                                Add to <span className="font-medium">{b.name}</span>
                            </label>
                        ))}
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-800">
                            <input
                                type="radio"
                                name="business"
                                value="new"
                                checked={businessChoice === "new"}
                                onChange={() => setBusinessChoice("new")}
                                className="h-4 w-4 accent-zinc-900"
                            />
                            A separate business (new company)
                        </label>
                    </div>
                </fieldset>
            )}

            {!pending && (businesses.length === 0 || businessChoice === "new") && (
                <fieldset className="rounded-xl border border-zinc-200 bg-white p-6">
                    <legend className="px-1 text-base font-semibold text-zinc-900">Your business</legend>
                    <p className="mt-1 text-sm text-zinc-500">
                        The company behind the shop. It owns your shops, holds your legal and billing details and your plan. Leave it empty to use the shop name; you can rename it later in the Business area.
                    </p>
                    <input
                        type="text"
                        maxLength={100}
                        value={newBusinessName}
                        onChange={(e) => setNewBusinessName(e.target.value)}
                        placeholder="Business name, e.g. Ben Salah Trading SARL"
                        className="mt-3 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                </fieldset>
            )}

            <ShopProfileForm
                key={version}
                initial={application ?? EMPTY_PROFILE}
                submitLabel={pending ? "Save changes" : another ? "Submit shop for review" : "Submit application"}
                onSubmit={save}
            />
        </div>
    )
}
