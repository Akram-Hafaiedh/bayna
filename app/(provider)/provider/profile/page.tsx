"use client"
// app/(provider)/provider/profile/page.tsx
// The shop's own profile: same form as the application, saved through /api/provider/profile.
import { useEffect, useState } from "react"
import { NOTIFICATIONS_NEW_EVENT } from "@/components/NotificationBell"
import ProviderProfileForm, { type ProfileValues } from "@/components/provider/ProviderProfileForm"

type Loaded = ProfileValues & { canEdit: boolean; isVerified: boolean; needsReview: boolean }

function toValues(p: Record<string, unknown>): Loaded {
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
        canEdit: p.canEdit === true,
        isVerified: p.isVerified === true,
        needsReview: p.needsReview === true,
    }
}

export default function ProviderProfilePage() {
    const [data, setData] = useState<Loaded | null>(null)
    const [version, setVersion] = useState(0)
    const [loadError, setLoadError] = useState("")
    const [message, setMessage] = useState("")

    useEffect(() => {
        let alive = true
        fetch("/api/provider/profile")
            .then(async (res) => {
                const json = await res.json()
                if (!alive) return
                if (!res.ok) setLoadError(json.error || "Could not load your profile")
                else setData(toValues(json.provider))
            })
            .catch(() => alive && setLoadError("Could not load your profile"))
        return () => {
            alive = false
        }
    }, [])

    // The bell saw something new (for example an admin finished the review): refresh only the status
    // banner, never the form, so what the person is typing is not lost
    useEffect(() => {
        async function refreshStatus() {
            try {
                const res = await fetch("/api/provider/profile", { cache: "no-store" })
                if (!res.ok) return
                const json = await res.json()
                setData((prev) =>
                    prev ? { ...prev, needsReview: json.provider.needsReview === true, isVerified: json.provider.isVerified === true } : prev
                )
            } catch {
                // keep what is shown
            }
        }
        window.addEventListener(NOTIFICATIONS_NEW_EVENT, refreshStatus)
        return () => window.removeEventListener(NOTIFICATIONS_NEW_EVENT, refreshStatus)
    }, [])

    async function save(body: Record<string, unknown>): Promise<string | null> {
        setMessage("")
        const res = await fetch("/api/provider/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) return json.error || "Could not save"
        setData(toValues(json.provider))
        setVersion((x) => x + 1) // reload the form with what was saved
        setMessage(
            json.changed.length === 0
                ? "Nothing changed."
                : json.flaggedForReview
                    ? "Saved. Your shop stays live; an admin will review the changes to your name or location."
                    : "Saved."
        )
        return null
    }

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Shop profile</h1>
                <p className="mt-1 text-sm text-zinc-500">How customers see and find your shop.</p>
            </div>

            {loadError && <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">{loadError}</div>}
            {!data && !loadError && <p className="text-sm text-zinc-500">Loading...</p>}

            {data?.needsReview && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                    Your recent changes to the name or location are waiting for an admin to look at them. Your shop stays live.
                </div>
            )}
            {message && <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{message}</div>}

            {data && (
                <ProviderProfileForm
                    key={version}
                    initial={data}
                    submitLabel="Save changes"
                    disabled={!data.canEdit}
                    onSubmit={save}
                    notice={
                        data.canEdit
                            ? "Changing the business name, address, city, governorate or map pin is saved right away and shown to an admin for review. Phone, WhatsApp and description need no review."
                            : "You can view the profile but not change it."
                    }
                />
            )}
        </div>
    )
}
