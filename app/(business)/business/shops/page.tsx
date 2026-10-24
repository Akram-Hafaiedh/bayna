import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import OpenShopButton from "@/components/business/OpenShopButton"

export const metadata: Metadata = { title: "Shops" }

export default function BusinessShopsPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopsContent />
            </Suspense>
        </div>
    )
}

async function ShopsContent() {
    const { business, access } = await requireBusinessArea()
    const [shops, perms] = await Promise.all([
        prisma.shop.findMany({
            where: { businessId: business.id, deletedAt: null },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: { id: true, publicId: true, name: true, city: true, governorate: true, isVerified: true },
        }),
        businessCan(business.id, ["business.shop.create"] as const),
    ])
    // Only shops the person can really open (the business-level role reaches every live shop)
    const openable = new Set(access.businessShops[business.id] ?? [])

    return (
        <>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Shops</h1>
                    <p className="mt-1 text-sm text-zinc-500">The outlets of {business.name}.</p>
                </div>
                {perms["business.shop.create"] && (
                    <Link href="/become-provider" className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                        Create shop
                    </Link>
                )}
            </div>

            <section className="rounded-xl border border-zinc-200 bg-white">
                {shops.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-zinc-500">No shops yet.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100 text-sm">
                        {shops.map((s) => (
                            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                                <div className="min-w-0">
                                    <Link href={`/business/shops/${s.publicId}`} className="block truncate font-medium text-zinc-900 hover:underline">
                                        {s.name}
                                    </Link>
                                    <p className="text-xs text-zinc-500">{[s.city, s.governorate].filter(Boolean).join(", ")}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {s.isVerified ? (
                                        <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700">Live</span>
                                    ) : (
                                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">Waiting for approval</span>
                                    )}
                                    {s.isVerified && openable.has(s.id) && <OpenShopButton shopId={s.id} shopPublicId={s.publicId} shopName={s.name} />}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <p className="text-xs text-zinc-500">
                A new shop is checked by an administrator before it goes live. The shop&apos;s own details, products and team are managed from its dashboard.
            </p>
        </>
    )
}
