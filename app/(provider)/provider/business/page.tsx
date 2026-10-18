import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { requireProvider } from "@/lib/provider-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import BusinessForm from "@/components/provider/BusinessForm"

export const metadata: Metadata = { title: "Business" }

export default function ProviderBusinessPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <BusinessContent />
            </Suspense>
        </div>
    )
}

async function BusinessContent() {
    await connection()
    // The business is the one the shop you are working in belongs to
    const shop = await requireProvider()
    const found = shop
        ? await prisma.provider.findUnique({
            where: { id: shop.id },
            select: {
                business: {
                    select: {
                        id: true,
                        name: true,
                        legalName: true,
                        taxId: true,
                        registryNumber: true,
                        billingEmail: true,
                        billingPhone: true,
                        billingAddress: true,
                        deletedAt: true,
                        shops: {
                            where: { deletedAt: null },
                            select: { id: true, businessName: true, city: true, isVerified: true },
                            orderBy: [{ businessName: "asc" }, { id: "asc" }],
                        },
                    },
                },
            },
        })
        : null
    const business = found?.business && !found.business.deletedAt ? found.business : null

    if (!business) {
        return (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This shop is not linked to a business yet. An administrator can fix this by running the businesses backfill.
            </p>
        )
    }

    const perms = await businessCan(business.id, ["business.profile.view", "business.profile.edit", "business.profile.edit_legal"] as const)

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Business</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    The company behind your shops: legal and billing details. Shop details (address, map pin, phone) are on each shop&apos;s profile.
                </p>
            </div>

            {!perms["business.profile.view"] ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Business details are managed by the business owner. Ask the owner if something needs to change.
                </p>
            ) : (
                <BusinessForm
                    key={business.id}
                    initial={{
                        name: business.name,
                        legalName: business.legalName ?? "",
                        taxId: business.taxId ?? "",
                        registryNumber: business.registryNumber ?? "",
                        billingEmail: business.billingEmail ?? "",
                        billingPhone: business.billingPhone ?? "",
                        billingAddress: business.billingAddress ?? "",
                    }}
                    canEdit={perms["business.profile.edit"]}
                    canEditLegal={perms["business.profile.edit_legal"]}
                />
            )}

            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-base font-semibold text-zinc-900">Shops in this business</h2>
                <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                    {business.shops.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0">
                                <span className="font-medium text-zinc-900">{s.businessName}</span>
                                <span className="ml-2 text-zinc-400">{s.city}</span>
                            </span>
                            {!s.isVerified && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Waiting for approval</span>}
                        </li>
                    ))}
                </ul>
            </section>
        </>
    )
}
