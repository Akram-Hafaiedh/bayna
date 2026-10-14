"use client"

// Building blocks shared by the product form (create and edit, linked and custom).
import type { Unit } from "@/app/generated/prisma/enums"
import type { CategoryTree } from "@/lib/provider-products"
import { UNIT_OPTIONS } from "@/lib/units"

export type FormValues = {
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

export type SetField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => void

export const inputClass =
    "w-full h-11 px-3.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-500"

export const textareaClass =
    "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"

export function Field({
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

export function Section({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <fieldset className="space-y-4">
            <legend className="sr-only">{title}</legend>
            <div aria-hidden="true">
                <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
                {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
            </div>
            {children}
        </fieldset>
    )
}

/** What the provider sets on any product: price, stock, ordering and visibility. */
export function OfferFields({
    form,
    set,
    showSku = true,
}: {
    form: FormValues
    set: SetField
    showSku?: boolean
}) {
    return (
        <Section title="Your offer" description="What you charge and have in stock.">
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Price (TND)" required>
                    <input
                        required
                        type="number"
                        inputMode="decimal"
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
                        inputMode="numeric"
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
                        inputMode="numeric"
                        step="1"
                        min="1"
                        placeholder="None"
                        value={form.minOrderQty}
                        onChange={(e) => set("minOrderQty", e.target.value)}
                        className={inputClass}
                    />
                </Field>
            </div>
            {showSku && (
                <Field label="Your SKU" hint="Optional. Your own reference for this product.">
                    <input
                        value={form.sku}
                        onChange={(e) => set("sku", e.target.value)}
                        className={inputClass}
                    />
                </Field>
            )}
            <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                    className="rounded border-zinc-300"
                />
                Active (visible to clients)
            </label>
        </Section>
    )
}

/** Identity and classification of a custom product (catalogue products inherit these). */
export function CustomFields({
    form,
    set,
    categories,
}: {
    form: FormValues
    set: SetField
    categories: CategoryTree[]
}) {
    return (
        <>
            <Section title="Product">
                <Field label="Name" required>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        className={inputClass}
                    />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name (Arabic)">
                        <input
                            dir="rtl"
                            value={form.nameAr}
                            onChange={(e) => set("nameAr", e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Brand">
                        <input
                            value={form.brand}
                            onChange={(e) => set("brand", e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea
                        rows={3}
                        value={form.description}
                        onChange={(e) => set("description", e.target.value)}
                        className={textareaClass}
                    />
                </Field>
            </Section>

            <Section title="Category and unit" description="How the product is grouped and sold.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Category">
                        <select
                            value={form.categoryId}
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
                    <Field label="Sold by">
                        <select
                            value={form.unit}
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
                </div>
            </Section>
        </>
    )
}
