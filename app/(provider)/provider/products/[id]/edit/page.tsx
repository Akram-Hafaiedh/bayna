import { Suspense } from "react"
import { notFound } from "next/navigation"
import { requireProvider } from "@/lib/provider-auth"
import { getCategoryTree, getProviderProduct } from "@/lib/provider-products"
import ProductForm from "@/components/provider/ProductForm"
import ConfirmPriceButton from "@/components/provider/ConfirmPriceButton"
import { shopCan } from "@/lib/access/page"

export default function EditProductPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Edit product
            </h1>

            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <EditProductContent params={params} />
            </Suspense>
        </div>
    )
}

async function EditProductContent({ params }: { params: Promise<{ id: string }> }) {
    const provider = await requireProvider()
    const { id } = await params
    if (!provider?.isVerified) notFound()

    const [product, categories, perms] = await Promise.all([
        getProviderProduct(provider.id, id),
        getCategoryTree(),
        shopCan(provider.id, ["product.price.edit"] as const),
    ])
    if (!product) notFound()

    return (
        <div className="space-y-6">
            {product.needsPriceReview && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">Check the price of this product</p>
                    <p className="mt-0.5 text-amber-800">
                        {product.priceReviewReason ?? "The catalogue item changed."} The price below was set for the old
                        unit, so it may be wrong. Until it is confirmed, this product is left out of comparison.
                    </p>
                    <p className="mt-2 text-amber-800">
                        Enter the new price below and save, or keep the current one.
                    </p>
                    {perms["product.price.edit"] ? (
                        <ConfirmPriceButton productId={product.id} className="mt-2 inline-block" />
                    ) : (
                        <p className="mt-2 font-medium">Ask the owner or a manager to confirm the price.</p>
                    )}
                </div>
            )}
            <ProductForm mode="edit" categories={categories} product={product} />
        </div>
    )
}
