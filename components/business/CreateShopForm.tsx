"use client"
// components/business/CreateShopForm.tsx
// A new shop for a business you already run. The business is known (it is the one you are working in), so
// there is no business question: just the shop's details. The shop starts "waiting for approval", and you
// land on its page in the Business area to keep filling it in.
import { useRouter } from "next/navigation"
import ShopProfileForm, { EMPTY_PROFILE } from "@/components/shop/ShopProfileForm"
import { useToast } from "@/components/ui/Toast"

export default function CreateShopForm({ businessId }: { businessId: string }) {
    const router = useRouter()
    const toast = useToast()

    async function create(body: Record<string, unknown>): Promise<string | null> {
        const res = await fetch("/api/shop/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, businessId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return json.error || "Could not create the shop"
        toast.success("Shop created", { description: "It goes live once an administrator approves it." })
        router.push(json.publicShopId ? `/business/shops/${json.publicShopId}` : "/business/shops")
        router.refresh()
        return null
    }

    return (
        <ShopProfileForm
            initial={EMPTY_PROFILE}
            submitLabel="Create shop"
            onSubmit={create}
            notice="A new shop is checked by an administrator before it goes live. You can keep filling in its details after you create it."
        />
    )
}
