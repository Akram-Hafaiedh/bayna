"use client"
// components/business/ShopDetailsEditor.tsx
// Edits one shop's details from the Business area, with the same form and the same rules as the shop's own
// profile page. A live shop is saved through /api/shop/profile (the x-shop header names the shop; the server
// checks you really have the permission there). A shop that is still waiting for approval is saved through
// the application route, which only its applicant may use. The page decides which one applies.
import { useState } from "react"
import { useRouter } from "next/navigation"
import ShopProfileForm, { type ProfileValues } from "@/components/shop/ShopProfileForm"
import { SHOP_HEADER } from "@/lib/shop-paths"

export default function ShopDetailsEditor({
    shopPublicId,
    initial,
    mode,
    aside,
}: {
    shopPublicId: string
    initial: ProfileValues
    /** "profile" = a live shop; "application" = waiting for approval (applicant only); "readonly" = view only */
    mode: "profile" | "application" | "readonly"
    /** shown in the right column under the contact details (server-rendered by the page) */
    aside?: React.ReactNode
}) {
    const router = useRouter()
    const [version, setVersion] = useState(0)
    const [message, setMessage] = useState("")

    async function save(body: Record<string, unknown>): Promise<string | null> {
        setMessage("")
        const res =
            mode === "profile"
                ? await fetch("/api/shop/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", [SHOP_HEADER]: shopPublicId },
                    body: JSON.stringify(body),
                })
                : await fetch("/api/shop/apply", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return json.error || "Could not save"
        setVersion((x) => x + 1)
        setMessage(
            mode === "application"
                ? "Saved."
                : json.changed && json.changed.length === 0
                    ? "Nothing changed."
                    : json.flaggedForReview
                        ? "Saved. The shop stays live; an admin will review the changes to its name or location."
                        : "Saved."
        )
        router.refresh() // the checklist and the facts above follow what was saved
        return null
    }

    return (
        <div className="space-y-4">
            {message && <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{message}</div>}
            <ShopProfileForm
                key={version}
                initial={initial}
                submitLabel="Save changes"
                disabled={mode === "readonly"}
                wide
                onSubmit={save}
                notice={
                    mode === "readonly"
                        ? "You can view this shop's details but not change them."
                        : mode === "application"
                            ? "This shop is waiting for approval. You can keep filling in its details until then."
                            : "Changing the name, address, city, governorate or map pin is saved right away and shown to an admin for review. Phone, WhatsApp and description need no review."
                }
            >
                {aside}
            </ShopProfileForm>
        </div>
    )
}
