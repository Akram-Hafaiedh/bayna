"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function NewProductPage() {
    const router = useRouter()
    const [form, setForm] = useState({
        name: "",
        nameAr: "",
        description: "",
        brand: "",
        sku: "",
        price: "",
        stock: "0",
        isActive: true,
    })
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/api/provider/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    price: form.price,
                    stock: form.stock,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to create product")
                return
            }
            router.push("/provider/products")
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Add product
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Create a new item in your catalog
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4"
            >
                <Field
                    label="Name"
                    required
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                />
                <Field
                    label="Name (Arabic)"
                    value={form.nameAr}
                    onChange={(v) => setForm({ ...form, nameAr: v })}
                />
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">
                        Description
                    </label>
                    <textarea
                        rows={3}
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-250 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                    />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Brand"
                        value={form.brand}
                        onChange={(v) => setForm({ ...form, brand: v })}
                    />
                    <Field
                        label="SKU"
                        value={form.sku}
                        onChange={(v) => setForm({ ...form, sku: v })}
                    />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Price (TND)"
                        required
                        type="number"
                        step="0.001"
                        min="0"
                        value={form.price}
                        onChange={(v) => setForm({ ...form, price: v })}
                    />
                    <Field
                        label="Stock"
                        type="number"
                        min="0"
                        value={form.stock}
                        onChange={(v) => setForm({ ...form, stock: v })}
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) =>
                            setForm({ ...form, isActive: e.target.checked })
                        }
                        className="rounded border-zinc-300"
                    />
                    Active (visible to clients)
                </label>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="h-10 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Create product"}
                    </button>
                    <Link
                        href="/provider/products"
                        className="text-sm text-zinc-500 hover:text-zinc-900"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    )
}

function Field({
    label,
    value,
    onChange,
    required,
    type = "text",
    step,
    min,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    required?: boolean
    type?: string
    step?: string
    min?: string
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>
            <input
                type={type}
                required={required}
                step={step}
                min={min}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
        </div>
    )
}