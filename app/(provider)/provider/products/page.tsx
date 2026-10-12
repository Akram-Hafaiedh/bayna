"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Product = {
    id: string
    name: string
    brand: string | null
    sku: string | null
    price: string | number
    stock: number
    isActive: boolean
    updatedAt: string
}

export default function ProviderProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)

    async function load() {
        setLoading(true)
        setError("")
        try {
            const res = await fetch("/api/provider/products")
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to load products")
                return
            }
            setProducts(data.products || [])
        } catch {
            setError("Failed to load products")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    async function handleDelete(id: string) {
        if (!confirm("Delete this product?")) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/provider/products/${id}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Delete failed")
                return
            }
            setProducts((prev) => prev.filter((p) => p.id !== id))
        } catch {
            setError("Delete failed")
        } finally {
            setDeletingId(null)
        }
    }

    function formatPrice(price: string | number) {
        const n = typeof price === "string" ? parseFloat(price) : price
        return n.toFixed(3) + " TND"
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                        Products
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Manage your catalog and stock
                    </p>
                </div>
                <Link
                    href="/provider/products/new"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Add product
                </Link>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-sm text-zinc-500">Loading...</p>
            ) : products.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                    <p className="text-sm text-zinc-500">No products yet.</p>
                    <Link
                        href="/provider/products/new"
                        className="mt-4 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                        Add your first product
                    </Link>
                </div>
            ) : (
                <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr className="text-left text-zinc-500">
                                <th className="px-4 py-3 font-medium">Product</th>
                                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                                    Price
                                </th>
                                <th className="px-4 py-3 font-medium">Stock</th>
                                <th className="px-4 py-3 font-medium hidden md:table-cell">
                                    Status
                                </th>
                                <th className="px-4 py-3 font-medium text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {products.map((p) => (
                                <tr key={p.id} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-zinc-900">
                                            {p.name}
                                        </p>
                                        <p className="text-xs text-zinc-400">
                                            {[p.brand, p.sku].filter(Boolean).join(" · ") ||
                                                "—"}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell text-zinc-700">
                                        {formatPrice(p.price)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={
                                                p.stock === 0
                                                    ? "text-red-600 font-medium"
                                                    : p.stock < 5
                                                        ? "text-amber-600 font-medium"
                                                        : "text-zinc-700"
                                            }
                                        >
                                            {p.stock}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        {p.isActive ? (
                                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">
                                                Hidden
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="inline-flex gap-3">
                                            <Link
                                                href={`/provider/products/${p.id}/edit`}
                                                className="text-xs font-medium text-zinc-700 hover:underline"
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                type="button"
                                                disabled={deletingId === p.id}
                                                onClick={() => handleDelete(p.id)}
                                                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}