import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import OpenShopButton from "@/components/business/OpenShopButton"

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
    const { business, access } = await requireBusinessArea()

    const shop = await prisma.shop.findFirst({
        where: { publicId, businessId: business.id, deletedAt: null },
        select: {
            id: true, name: true, description: true, phone: true, whatsapp: true,
            address: true, city: true, governorate: true, isVerified: true, createdAt: true,
            _count: { select: { products: { where: { deletedAt: null } } } },
        },
    })
    if (!shop) notFound()

    const people = await prisma.accessAssignment.count({ where: { providerId: shop.id, status: "ACTIVE" } })
    const canOpen = shop.isVerified && (access.businessShops[business.id] ?? []).includes(shop.id)
    const where = [shop.address, shop.city, shop.governorate].filter(Boolean).join(", ")

    const facts: [string, string][] = [
        ["Place", where || "Not set"],
        ["Phone", shop.phone || "Not set"],
        ["WhatsApp", shop.whatsapp || "Not set"],
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

            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                {shop.description && <p className="mb-4 text-sm text-zinc-600">{shop.description}</p>}
                <dl className="divide-y divide-zinc-100 text-sm">
                    {facts.map(([label, value]) => (
                        <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5">
                            <dt className="text-zinc-500">{label}</dt>
                            <dd className="font-medium text-zinc-900">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 text-xs text-zinc-500">
                    The shop&apos;s details, products and team are changed from its own dashboard: open the shop to do that.
                </p>
            </section>
        </>
    )
}
