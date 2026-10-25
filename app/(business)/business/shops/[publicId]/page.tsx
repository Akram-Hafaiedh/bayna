import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { effective, has } from "@/lib/access/evaluate"
import { shopSetup } from "@/lib/shop-setup"
import OpenShopButton from "@/components/business/OpenShopButton"
import ShopDetailsEditor from "@/components/business/ShopDetailsEditor"

export const metadata: Metadata = { title: "Shop" }

// The shop is found by its public id (the opaque one meant for URLs), and only inside the business
// the person is working in: a public id from another business is simply "not found".
export default function BusinessShopPage({ params }: { params: Promise<{ publicId: string }> }) {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopContent params={params} />
            </Suspense>
        </div>
    )
}

async function ShopContent({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = await params
    const { business, access, userId } = await requireBusinessArea()

    const shop = await prisma.shop.findFirst({
        where: { publicId, businessId: business.id, deletedAt: null },
        select: {
            id: true, userId: true, name: true, description: true, phone: true, whatsapp: true,
            address: true, city: true, governorate: true, latitude: true, longitude: true, locationSource: true,
            isVerified: true, createdAt: true,
            _count: { select: { products: { where: { deletedAt: null } } } },
        },
    })
    if (!shop) notFound()

    const people = await prisma.accessAssignment.count({ where: { providerId: shop.id, status: "ACTIVE" } })
    const canOpen = shop.isVerified && (access.businessShops[business.id] ?? []).includes(shop.id)

    // What this person may do in this shop, worked out the way the routes do it
    const eff = effective(access.assignments, { providerId: shop.id, businessId: business.id })
    const canEdit = has(eff, "shop.profile.edit")
    // A live shop is edited through the shop profile route; one still waiting for approval can only be
    // edited by the person who applied for it
    const mode = shop.isVerified ? (canEdit ? "profile" : "readonly") : shop.userId === userId ? "application" : "readonly"

    const setup = shopSetup(shop)
    const todo = setup.items.filter((i) => !i.done && !i.optional)

    const facts: [string, string][] = [
        ["Products", String(shop._count.products)],
        ["People in the shop team", String(people)],
        ["Created", shop.createdAt.toISOString().slice(0, 10)],
    ]

    return (
        <>
            <div>
                <Link href="/business/shops" className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                    All shops of {business.name}
                </Link>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900">{shop.name}</h1>
                        <p className="mt-1">
                            {shop.isVerified ? (
                                <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700">Live</span>
                            ) : (
                                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">Waiting for approval</span>
                            )}
                        </p>
                    </div>
                    {canOpen && <OpenShopButton shopId={shop.id} shopPublicId={publicId} shopName={shop.name} />}
                </div>
            </div>

            {todo.length > 0 && (
                <section className="rounded-xl border border-amber-100 bg-amber-50 p-5">
                    <h2 className="text-sm font-semibold text-amber-900">
                        {todo.length === 1 ? "1 thing left to fill in" : `${todo.length} things left to fill in`}
                    </h2>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                        {todo.map((i) => (
                            <li key={i.key}>
                                <span className="font-medium">{i.label}</span> <span className="text-amber-800">{i.hint}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs text-amber-800">Fill them in below and save.</p>
                </section>
            )}

            <ShopDetailsEditor
                shopPublicId={publicId}
                mode={mode}
                initial={{
                    name: shop.name,
                    description: shop.description ?? "",
                    phone: shop.phone ?? "",
                    whatsapp: shop.whatsapp ?? "",
                    address: shop.address ?? "",
                    city: shop.city,
                    governorate: shop.governorate ?? "",
                    latitude: shop.latitude,
                    longitude: shop.longitude,
                    locationSource: shop.locationSource ?? (shop.latitude != null && shop.longitude != null ? "IMPORTED" : null),
                }}
            />

            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-base font-semibold text-zinc-900">At a glance</h2>
                <dl className="mt-3 divide-y divide-zinc-100 text-sm">
                    {facts.map(([label, value]) => (
                        <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5">
                            <dt className="text-zinc-500">{label}</dt>
                            <dd className="font-medium text-zinc-900">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 text-xs text-zinc-500">
                    The shop&apos;s team is managed from <Link href="/business/team" className="underline underline-offset-2">the Business team</Link>; its products from the shop dashboard.
                </p>
            </section>
        </>
    )
}
