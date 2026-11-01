import { Suspense } from "react"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { getCategoryTree } from "@/lib/shops/shop-products"
import ProductForm from "@/components/shop/ProductForm"
import { shopCan } from "@/lib/access/page"
import { listTaxes } from "@/lib/pricing/taxes"

export default function NewProductPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Add product
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Create a new item in your catalog
                </p>
            </div>

            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <NewProductContent params={params} />
            </Suspense>
        </div>
    )
}

async function NewProductContent({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)
    if (shop?.status !== "ACTIVE") {
        return (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Your account is not verified yet. You can add products once an admin
                approves you.
            </div>
        )
    }
    const [categories, taxes, perms] = await Promise.all([
        getCategoryTree(),
        listTaxes(shop.id),
        shopCan(shop.id, ["product.price.edit"] as const),
    ])
    return <ProductForm mode="create" categories={categories} taxes={taxes} canEditTaxes={perms["product.price.edit"]} />
}
