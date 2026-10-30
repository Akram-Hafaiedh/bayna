"use client"

// Shared pieces for the admin catalogue screens: category loading, a grouped category
// select, and one form used to create, edit and approve catalogue items.
import { useEffect, useState } from "react"
import type { Unit } from "@/app/generated/prisma/enums"
import { UNIT_OPTIONS } from "@/lib/catalogue/units"

export type AdminCategory = {
    id: string
    name: string
    nameAr: string | null
    slug: string
    description: string | null
    parentId: string | null
    sortOrder: number
    itemCount: number
    productCount: number
}

export function useAdminCategories() {
    const [categories, setCategories] = useState<AdminCategory[]>([])
    const [error, setError] = useState("")

    async function reload() {
        try {
            const res = await fetch("/api/admin/categories")
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to load categories")
                return
            }
            setCategories(data.categories)
        } catch {
            setError("Failed to load categories")
        }
    }

    useEffect(() => {
        reload()
    }, [])

    return { categories, error, reload }
}

export const inputClass =
    "w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"

/** Roots with children become optgroups; roots without children are plain options. */
export function CategorySelect({
    categories,
    value,
    onChange,
    allowEmpty,
    emptyLabel = "Choose a category",
    id,
}: {
    categories: AdminCategory[]
    value: string
    onChange: (v: string) => void
    allowEmpty?: boolean
    emptyLabel?: string
    id?: string
}) {
    const roots = categories.filter((c) => !c.parentId)
    return (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            {(allowEmpty || !value) && <option value="">{emptyLabel}</option>}
            {roots.map((root) => {
                const children = categories.filter((c) => c.parentId === root.id)
                return children.length > 0 ? (
                    <optgroup key={root.id} label={root.name}>
                        {children.map((c) => (
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
            })}
        </select>
    )
}

export type ItemValues = {
    name: string
    nameAr: string
    brand: string
    description: string
    unit: Unit
    categoryId: string
}

export const EMPTY_ITEM: ItemValues = {
    name: "",
    nameAr: "",
    brand: "",
    description: "",
    unit: "PIECE",
    categoryId: "",
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="block text-xs font-medium text-zinc-600">{label}</span>
            {children}
        </label>
    )
}

/** onSubmit returns an error message to show, or null on success. */
export function CatalogItemForm({
    categories,
    initial,
    submitLabel,
    hint,
    onSubmit,
    onCancel,
}: {
    categories: AdminCategory[]
    initial: ItemValues
    submitLabel: string
    hint?: string
    onSubmit: (values: ItemValues) => Promise<string | null>
    onCancel: () => void
}) {
    const [v, setV] = useState<ItemValues>(initial)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const set = <K extends keyof ItemValues>(k: K, val: ItemValues[K]) => setV((x) => ({ ...x, [k]: val }))

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true)
        setError("")
        const err = await onSubmit(v)
        if (err) setError(err)
        setBusy(false)
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <L label="Name *">
                    <input required value={v.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
                </L>
                <L label="Name (Arabic)">
                    <input dir="rtl" value={v.nameAr} onChange={(e) => set("nameAr", e.target.value)} className={inputClass} />
                </L>
                <L label="Category *">
                    <CategorySelect categories={categories} value={v.categoryId} onChange={(x) => set("categoryId", x)} />
                </L>
                <L label="Sold by *">
                    <select value={v.unit} onChange={(e) => set("unit", e.target.value as Unit)} className={inputClass}>
                        {UNIT_OPTIONS.map((u) => (
                            <option key={u.value} value={u.value}>
                                {u.label}
                            </option>
                        ))}
                    </select>
                </L>
                <L label="Brand">
                    <input value={v.brand} onChange={(e) => set("brand", e.target.value)} className={inputClass} />
                </L>
                <L label="Description">
                    <input value={v.description} onChange={(e) => set("description", e.target.value)} className={inputClass} />
                </L>
            </div>
            {hint && <p className="text-xs text-zinc-400">{hint}</p>}
            {error && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={busy || !v.categoryId}
                    className="h-9 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                    {busy ? "Saving..." : submitLabel}
                </button>
                <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-900">
                    Cancel
                </button>
            </div>
        </form>
    )
}
