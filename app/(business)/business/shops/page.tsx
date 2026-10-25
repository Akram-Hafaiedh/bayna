import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import ShopsList from "@/components/business/ShopsList"
import { shopSetup } from "@/lib/shop-setup"
import type { ShopRow } from "@/lib/shop-list"

export const metadata: Metadata = { title: "Shops" }

export default function BusinessShopsPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopsContent />
            </Suspense>
        </div>
    )
}

async function ShopsContent() {
    const { business, access } = await requireBusinessArea()
    const [found, perms] = await Promise.all([
        prisma.shop.findMany({
            where: { businessId: business.id, deletedAt: null },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: {
                id: true, publicId: true, name: true, city: true, governorate: true, status: true,
                description: true, phone: true, whatsapp: true, address: true, latitude: true, longitude: true,
                _count: {
                    select: {
                        products: { where: { deletedAt: null } },
                        accessAssignments: { where: { status: "ACTIVE" } },
                    },
                },
            },
        }),
        businessCan(business.id, ["business.shop.create", "business.shop.change_status"] as const),
    ])
    // Only shops the person can really open (the business-level role reaches every live shop)
    const reachable = new Set(access.businessShops[business.id] ?? [])

    const shops: ShopRow[] = found.map((s) => {
        const setup = shopSetup(s)
        const required = setup.items.filter((i) => !i.optional).length
        return {
            id: s.id,
            publicId: s.publicId,
            name: s.name,
            city: s.city,
            governorate: s.governorate,
            status: s.status,
            products: s._count.products,
            team: s._count.accessAssignments,
            setupDone: required - setup.missing,
            setupTotal: required,
            openable: s.status === "ACTIVE" && reachable.has(s.id),
        }
    })

    return (
        <>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Shops</h1>
                    <p className="mt-1 text-sm text-zinc-500">The outlets of {business.name}.</p>
                </div>
                {perms["business.shop.create"] && (
                    <Link href="/business/shops/new" className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                        Create shop
                    </Link>
                )}
            </div>

            <ShopsList shops={shops} canChangeStatus={perms["business.shop.change_status"] === true} />

            <p className="text-xs text-zinc-500">
                A new shop is checked by an administrator before it goes live. Use the menu on a row to edit a shop, open its dashboard or close it.
            </p>
        </>
    )
}
