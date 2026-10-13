"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Unit } from "@/app/generated/prisma/enums"
import type { CategoryTree, ProductDetail } from "@/lib/provider-products"
import { UNIT_OPTIONS } from "@/lib/units"
import CatalogPicker, { type CatalogResult } from "./CatalogPicker"

type FormValues = {
    name: string
    nameAr: string
    description: string
    brand: string
    sku: string
    unit: Unit
    categoryId: string
    price: string
    stock: string
    minOrderQty: string
    isActive: boolean
}

const EMPTY: FormValues = {
    name: "",
    nameAr: "",
    description: "",
    brand: "",
    sku: "",
    unit: "PIECE",
    categoryId: "",
    price: "",
    stock: "0",
    minOrderQty: "",
    isActive: true,
}

function fromProduct(p: ProductDetail): FormValues {
    return {
        name: p.name,
        nameAr: p.nameAr ?? "",
        description: p.description ?? "",
        brand: p.brand ?? "",
        sku: p.sku ?? "",
        unit: p.unit,
        categoryId: p.categoryId ?? "",
        price: p.price,
        stock: String(p.stock),
        minOrderQty: p.minOrderQty === null ? "" : String(p.minOrderQty),
        isActive: p.isActive,
    }
}

const inputClass =
    "w-full h-11 px-3.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-500"

export default function ProductForm({
    mode,
    categories,
    product,
}: {
    mode: "create" | "edit"
    categories: CategoryTree[]
    product?: ProductDetail
}) {
    const router = useRouter()
    const [form, setForm] = useState<FormValues>(product ? fromProduct(product) : EMPTY)
    const [catalog, setCatalog] = useState<{ id: string; name: string } | null>(
        product?.catalogItem ?? null
    )
    // Create flow: choose a catalogue item first, or go custom
    const [custom, setCustom] = useState(false)
    const [error, setError] = useState("")
    const [existingId, setExistingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const locked = catalog !== null
    const showPicker = mode === "create" && !catalog && !custom

    function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
        setForm((f) => ({ ...f, [key]: value }))
    }

    function pick(item: CatalogResult) {
        setCatalog({ id: item.id, name: item.name })
        setForm((f) => ({
            ...f,
            name: item.name,
            nameAr: item.nameAr ?? "",
            brand: item.brand ?? "",
            unit: item.unit,
            categoryId: item.category.id,
        }))
    }

    function resetSelection() {
        setCatalog(null)
        setCustom(false)
        setForm(EMPTY)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setExistingId(null)
        setLoading(true)

        try {
            const isEdit = mode === "edit" && product
            const res = await fetch(
                isEdit ? `/api/provider/products/${product.id}` : "/api/provider/products",
                {
                    method: isEdit ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                        isEdit ? form : { ...form, catalogItemId: catalog?.id }
                    ),
                }
            )
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to save product")
                if (data.productId) setExistingId(data.productId)
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

    if (showPicker) {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
                <div>
                    <h2 className="font-medium text-zinc-900">Start from the catalogue</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                        Linked products appear in price comparisons across providers.
                    </p>
                </div>
                <CatalogPicker onPick={pick} />
                <div className="flex items-center justify-between pt-1 text-sm">
                    <button
                        type="button"
                        onClick={() => setCustom(true)}
                        className="text-zinc-600 hover:text-zinc-900"
                    >
                        Not in the catalogue? Add a custom product
                    </button>
                    <Link href="/provider/products" className="text-zinc-500 hover:text-zinc-900">
                        Cancel
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4"
        >
            {catalog && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3.5 py-2.5 text-sm">
                    <p className="text-zinc-600">
                        Linked to catalogue item{" "}
                        <span className="font-medium text-zinc-900">{catalog.name}</span>
                    </p>
                    {mode === "create" && (
                        <button
                            type="button"
                            onClick={resetSelection}
                            className="shrink-0 text-zinc-500 hover:text-zinc-900"
                        >
                            Change
                        </button>
                    )}
                </div>
            )}
            {mode === "create" && custom && !catalog && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3.5 py-2.5 text-sm">
                    <p className="text-zinc-600">Custom product (not compared with other providers)</p>
                    <button
                        type="button"
                        onClick={resetSelection}
                        className="shrink-0 text-zinc-500 hover:text-zinc-900"
                    >
                        Use the catalogue
                    </button>
                </div>
            )}

            <Field label="Name" required>
                <input
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className={inputClass}
                />
            </Field>
            <Field label="Name (Arabic)">
                <input
                    value={form.nameAr}
                    onChange={(e) => set("nameAr", e.target.value)}
                    className={inputClass}
                />
            </Field>
            <Field label="Description">
                <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brand">
                    <input
                        value={form.brand}
                        onChange={(e) => set("brand", e.target.value)}
                        className={inputClass}
                    />
                </Field>
                <Field label="SKU">
                    <input
                        value={form.sku}
                        onChange={(e) => set("sku", e.target.value)}
                        className={inputClass}
                    />
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Unit" hint={locked ? "Defined by the catalogue item" : undefined}>
                    <select
                        value={form.unit}
                        disabled={locked}
                        onChange={(e) => set("unit", e.target.value as Unit)}
                        className={inputClass}
                    >
                        {UNIT_OPTIONS.map((u) => (
                            <option key={u.value} value={u.value}>
                                {u.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Category" hint={locked ? "Defined by the catalogue item" : undefined}>
                    <select
                        value={form.categoryId}
                        disabled={locked}
                        onChange={(e) => set("categoryId", e.target.value)}
                        className={inputClass}
                    >
                        <option value="">No category</option>
                        {categories.map((root) =>
                            root.children.length > 0 ? (
                                <optgroup key={root.id} label={root.name}>
                                    {root.children.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ) : (
                                <option key={root.id} value={root.id}>
                                    {root.name}
                                </option>
                            )
                        )}
                    </select>
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Price (TND)" required>
                    <input
                        required
                        type="number"
                        step="0.001"
                        min="0"
                        value={form.price}
                        onChange={(e) => set("price", e.target.value)}
                        className={inputClass}
                    />
                </Field>
                <Field label="Stock">
                    <input
                        type="number"
                        step="1"
                        min="0"
                        value={form.stock}
                        onChange={(e) => set("stock", e.target.value)}
                        className={inputClass}
                    />
                </Field>
                <Field label="Min. order">
                    <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="None"
                        value={form.minOrderQty}
                        onChange={(e) => set("minOrderQty", e.target.value)}
                        className={inputClass}
                    />
                </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                    className="rounded border-zinc-300"
                />
                Active (visible to clients)
            </label>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                    {existingId && (
                        <>
                            {" "}
                            <Link href={`/provider/products/${existingId}/edit`} className="underline">
                                Edit it
                            </Link>
                        </>
                    )}
                </div>
            )}

            <div className="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                    {loading ? "Saving..." : mode === "edit" ? "Save changes" : "Create product"}
                </button>
                <Link
                    href="/provider/products"
                    className="text-sm text-zinc-500 hover:text-zinc-900"
                >
                    Cancel
                </Link>
            </div>
        </form>
    )
}

function Field({
    label,
    required,
    hint,
    children,
}: {
    label: string
    required?: boolean
    hint?: string
    children: React.ReactNode
}) {
    return (
        <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-zinc-700">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </span>
            {children}
            {hint && <span className="block text-xs text-zinc-400">{hint}</span>}
        </label>
    )
}
