import { Suspense } from "react"
import { notFound } from "next/navigation"
import { requireProvider } from "@/lib/provider-auth"
import { getCategoryTree, getProviderProduct } from "@/lib/provider-products"
import ProductForm from "@/components/provider/ProductForm"

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

    const [product, categories] = await Promise.all([
        getProviderProduct(provider.id, id),
        getCategoryTree(),
    ])
    if (!product) notFound()

    return <ProductForm mode="edit" categories={categories} product={product} />
}
