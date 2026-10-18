"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/components/ui/Toast"
import type { CategoryTree, ProductDetail } from "@/lib/provider-products"
import { UNIT_NAMES } from "@/lib/units"
import CatalogPicker, { type CatalogResult } from "./CatalogPicker"
import {
    CustomFields,
    Field,
    OfferFields,
    Section,
    textareaClass,
    type FormValues,
    type SetField,
} from "./ProductFormParts"

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

type Source = "catalogue" | "custom"

function categoryName(tree: CategoryTree[], id: string): string | null {
    for (const root of tree) {
        if (root.id === id) return root.name
        const child = root.children.find((c) => c.id === id)
        if (child) return `${root.name} › ${child.name}`
    }
    return null
}

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
    const toast = useToast()
    const [form, setForm] = useState<FormValues>(product ? fromProduct(product) : EMPTY)
    const [catalog, setCatalog] = useState<{ id: string; name: string } | null>(
        product?.catalogItem ?? null
    )
    const [source, setSource] = useState<Source>(
        mode === "edit" && !product?.catalogItem ? "custom" : "catalogue"
    )
    const [suggest, setSuggest] = useState(true)
    const [suggestNote, setSuggestNote] = useState("")
    const [error, setError] = useState("")
    const [existing, setExisting] = useState<{ href: string; label: string } | null>(null)
    const [loading, setLoading] = useState(false)

    const isLinked = catalog !== null
    // Catalogue source with nothing picked yet: the picker is shown, nothing to save
    const picking = mode === "create" && source === "catalogue" && !catalog

    const set: SetField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

    function chooseSource(next: Source) {
        if (next === source) return
        setSource(next)
        setCatalog(null)
        setForm(EMPTY)
        setError("")
        setExisting(null)
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

    function cantFind(query: string) {
        setSource("custom")
        setCatalog(null)
        setSuggest(true)
        setForm({ ...EMPTY, name: query })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (picking) return
        setError("")
        setExisting(null)

        if (mode === "create" && source === "custom" && suggest && !form.categoryId) {
            setError("Choose a category to suggest this item for the catalogue.")
            return
        }

        setLoading(true)
        try {
            const isEdit = mode === "edit" && product
            const payload = isEdit
                ? form
                : {
                    ...form,
                    catalogItemId: catalog?.id,
                    ...(source === "custom" && suggest
                        ? { suggestToCatalogue: true, suggestionNote: suggestNote }
                        : {}),
                }
            const res = await fetch(
                isEdit ? `/api/provider/products/${product.id}` : "/api/provider/products",
                {
                    method: isEdit ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            )
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to save product")
                if (data.inTrash) {
                    setExisting({ href: "/provider/products/trash", label: "Open the Trash" })
                } else if (data.productId) {
                    setExisting({
                        href: `/provider/products/${data.productId}/edit`,
                        label: "Edit it",
                    })
                } else if (data.catalogItemName) {
                    setExisting({ href: "", label: data.catalogItemName })
                }
                return
            }
            toast.success(isEdit ? `Saved "${form.name || product.name}"` : `Added "${data.product?.name ?? form.name}"`)
            router.push("/provider/products")
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    const submitLabel = loading
        ? "Saving..."
        : mode === "edit"
            ? "Save changes"
            : "Create product"

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-zinc-200 bg-white p-6 space-y-6"
        >
            {mode === "create" && (
                <SourceChoice value={source} onChange={chooseSource} />
            )}

            {mode === "edit" && product?.suggestion && !isLinked && (
                <SuggestionStatus
                    status={product.suggestion.status}
                    note={product.suggestion.reviewNote}
                />
            )}

            {picking && (
                <CatalogPicker onPick={pick} onCantFind={cantFind} />
            )}

            {isLinked && (
                <>
                    <LinkedSummary
                        name={catalog.name}
                        nameAr={form.nameAr}
                        brand={form.brand}
                        category={categoryName(categories, form.categoryId)}
                        unit={UNIT_NAMES[form.unit]}
                        onChange={
                            mode === "create"
                                ? () => {
                                    setCatalog(null)
                                    setForm(EMPTY)
                                }
                                : undefined
                        }
                    />
                    <OfferFields form={form} set={set} />
                    <Section title="Details" description="Optional. Shown with your offer.">
                        <Field label="Description">
                            <textarea
                                rows={3}
                                value={form.description}
                                onChange={(e) => set("description", e.target.value)}
                                className={textareaClass}
                            />
                        </Field>
                    </Section>
                </>
            )}

            {!picking && !isLinked && (
                <>
                    <CustomFields form={form} set={set} categories={categories} />
                    <OfferFields form={form} set={set} />
                    {mode === "create" && (
                        <SuggestBox
                            checked={suggest}
                            onChange={setSuggest}
                            note={suggestNote}
                            onNote={setSuggestNote}
                        />
                    )}
                </>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600"
                >
                    {error}
                    {existing?.href && (
                        <>
                            {" "}
                            <Link href={existing.href} className="underline">
                                {existing.label}
                            </Link>
                        </>
                    )}
                    {existing && !existing.href && (
                        <>
                            {" "}
                            Search for &ldquo;{existing.label}&rdquo; in the catalogue.
                        </>
                    )}
                </div>
            )}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-3 rounded-b-xl border-t border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur">
                <Link
                    href="/provider/products"
                    className="h-10 px-3 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900"
                >
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading || picking}
                    className="h-10 px-5 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                    {submitLabel}
                </button>
            </div>
        </form>
    )
}

function SourceChoice({
    value,
    onChange,
}: {
    value: Source
    onChange: (next: Source) => void
}) {
    const options: { id: Source; title: string; text: string }[] = [
        {
            id: "catalogue",
            title: "From the catalogue",
            text: "Pick a known item. Clients can compare your price with other providers.",
        },
        {
            id: "custom",
            title: "Custom product",
            text: "Your own listing. You can also suggest it for the catalogue.",
        },
    ]
    return (
        <div role="radiogroup" aria-label="Product type" className="grid gap-3 sm:grid-cols-2">
            {options.map((o) => {
                const on = value === o.id
                return (
                    <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(o.id)}
                        className={`rounded-lg border p-3.5 text-left transition ${on
                            ? "border-zinc-900 ring-1 ring-zinc-900"
                            : "border-zinc-200 hover:border-zinc-400"
                            }`}
                    >
                        <span className="block text-sm font-medium text-zinc-900">{o.title}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{o.text}</span>
                    </button>
                )
            })}
        </div>
    )
}

function LinkedSummary({
    name,
    nameAr,
    brand,
    category,
    unit,
    onChange,
}: {
    name: string
    nameAr: string
    brand: string
    category: string | null
    unit: string
    onChange?: () => void
}) {
    return (
        <div className="rounded-lg bg-zinc-50 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Catalogue item
                    </p>
                    <p className="mt-0.5 font-medium text-zinc-900">{name}</p>
                    {nameAr && (
                        <p className="text-sm text-zinc-500" dir="rtl">
                            {nameAr}
                        </p>
                    )}
                    <p className="mt-1 text-sm text-zinc-500">
                        {[brand, category, unit].filter(Boolean).join(" · ")}
                    </p>
                </div>
                {onChange && (
                    <button
                        type="button"
                        onClick={onChange}
                        className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900"
                    >
                        Change
                    </button>
                )}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
                Name, unit and category come from the catalogue so prices stay comparable.
            </p>
        </div>
    )
}

function SuggestBox({
    checked,
    onChange,
    note,
    onNote,
}: {
    checked: boolean
    onChange: (v: boolean) => void
    note: string
    onNote: (v: string) => void
}) {
    return (
        <div className="rounded-lg border border-zinc-200 p-4 space-y-3">
            <label className="flex items-start gap-2.5 text-sm text-zinc-700">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300"
                />
                <span>
                    <span className="font-medium text-zinc-900">Suggest this for the catalogue</span>
                    <span className="block text-zinc-500">
                        An admin reviews it. Once approved, your product is linked to the catalogue
                        item and compared with other providers. Your listing stays live meanwhile.
                    </span>
                </span>
            </label>
            {checked && (
                <Field label="Note for the admin" hint="Optional. For example the exact size or standard.">
                    <textarea
                        rows={2}
                        maxLength={500}
                        value={note}
                        onChange={(e) => onNote(e.target.value)}
                        className={textareaClass}
                    />
                </Field>
            )}
        </div>
    )
}

function SuggestionStatus({
    status,
    note,
}: {
    status: "PENDING" | "APPROVED" | "REJECTED"
    note: string | null
}) {
    if (status === "APPROVED") return null
    const pending = status === "PENDING"
    return (
        <div
            className={`rounded-lg px-4 py-3 text-sm ${pending ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-zinc-700"
                }`}
        >
            {pending
                ? "You suggested this item for the catalogue. It is waiting for review."
                : `Your catalogue suggestion was not accepted${note ? `: ${note}` : "."} The product stays as a custom listing.`}
        </div>
    )
}
