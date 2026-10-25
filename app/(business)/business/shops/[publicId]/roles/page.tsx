import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { loadRoleItems, shopOwner } from "@/lib/access/role-pages"
import RolesList from "@/components/access/RolesList"

export const metadata: Metadata = { title: "Shop roles" }

// The roles of one shop, from the Business area. Opening, editing and creating a role use the Business
// role pages, which already handle the roles of every shop of the business.
export default function BusinessShopRolesPage({ params }: { params: Promise<{ publicId: string }> }) {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopRolesContent params={params} />
            </Suspense>
        </div>
    )
}

async function ShopRolesContent({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = await params
    const { business, access } = await requireBusinessArea()

    const shop = await prisma.shop.findFirst({
        where: { publicId, businessId: business.id, deletedAt: null },
        select: { id: true, name: true, status: true },
    })
    if (!shop) notFound()

    if (shop.status !== "ACTIVE") {
        return <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">The roles of a shop can be managed once the shop is active.</p>
    }
    const owner = shopOwner(access, shop, business.id)
    if (!owner.canView) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to this shop&apos;s roles. Ask an owner.</p>
    }

    const items = await loadRoleItems([owner])
    return (
        <>
            <p className="text-sm text-zinc-500">
                What each role in {shop.name} can do. Roles are given from the Team tab. Roles of the whole business are on the{" "}
                <Link href="/business/roles" className="underline underline-offset-2 hover:text-zinc-900">Business roles page</Link>.
            </p>
            <RolesList items={items} basePath="/business/roles" canCreate={owner.canManage} newPath={`/business/roles/new?for=${shop.id}`} />
        </>
    )
}
