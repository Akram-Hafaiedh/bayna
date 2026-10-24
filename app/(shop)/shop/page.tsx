import { Suspense } from "react"
import type { Metadata } from "next"
import { requireRole } from "@/lib/session"
import { Role } from "@/app/generated/prisma/enums"
import { redirectToMyShop } from "@/lib/shop-auth"
import { cleanSection } from "@/lib/shop-paths"

export const metadata: Metadata = { title: "My shop" }

// "/shop" has no shop in it: it opens the shop you used last (or the first one you work in), on the
// dashboard or on the section named in ?to=, for example /shop?to=team.
export default function ShopLandingPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
    return (
        <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Opening your shop...</div>}>
            <Landing searchParams={searchParams} />
        </Suspense>
    )
}

async function Landing({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
    const user = await requireRole([Role.PROVIDER])
    const { to } = await searchParams
    return redirectToMyShop(user.id, cleanSection(to) || "dashboard")
}
