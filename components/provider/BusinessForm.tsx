"use client"
// components/provider/BusinessForm.tsx
// Legal and billing details of the business. Saved through /api/provider/business.
// Legal fields are locked unless the person may edit them (business owner); the server checks again.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"

export type BusinessValues = {
    name: string
    legalName: string
    taxId: string
    registryNumber: string
    billingEmail: string
    billingPhone: string
    billingAddress: string
}

const inputClass =
    "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
        </label>
    )
}

export default function BusinessForm({
    initial,
    canEdit,
    canEditLegal,
}: {
    initial: BusinessValues
    canEdit: boolean
    canEditLegal: boolean
}) {
    const router = useRouter()
    const toast = useToast()
    const [v, setV] = useState<BusinessValues>(initial)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const set = (k: keyof BusinessValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setV((x) => ({ ...x, [k]: e.target.value }))

    async function save(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setSaving(true)
        try {
            // Send only what this person may change
            const body: Partial<BusinessValues> = {
                name: v.name,
                billingEmail: v.billingEmail,
                billingPhone: v.billingPhone,
                billingAddress: v.billingAddress,
                ...(canEditLegal ? { legalName: v.legalName, taxId: v.taxId, registryNumber: v.registryNumber } : {}),
            }
            const res = await fetch("/api/provider/business", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Could not save")
                return
            }
            const b = data.business
            setV({
                name: b.name ?? "",
                legalName: b.legalName ?? "",
                taxId: b.taxId ?? "",
                registryNumber: b.registryNumber ?? "",
                billingEmail: b.billingEmail ?? "",
                billingPhone: b.billingPhone ?? "",
                billingAddress: b.billingAddress ?? "",
            })
            toast.success(data.changed?.length ? "Business details saved" : "Nothing changed")
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={save} className="space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
                <h2 className="text-base font-semibold text-zinc-900">The business</h2>
                <Field label="Business name" hint="The company behind your shops. Each shop has its own name in its shop profile.">
                    <input className={inputClass} value={v.name} onChange={set("name")} disabled={!canEdit || saving} required maxLength={100} />
                </Field>
                <Field label="Legal name" hint="The official company name, as on your registration.">
                    <input className={inputClass} value={v.legalName} onChange={set("legalName")} disabled={!canEditLegal || saving} maxLength={150} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Tax number (matricule fiscal)" hint="For example 1234567/A/M/000">
                        <input className={inputClass} value={v.taxId} onChange={set("taxId")} disabled={!canEditLegal || saving} maxLength={40} />
                    </Field>
                    <Field label="Registry number (RNE)">
                        <input className={inputClass} value={v.registryNumber} onChange={set("registryNumber")} disabled={!canEditLegal || saving} maxLength={40} />
                    </Field>
                </div>
                {canEdit && !canEditLegal && (
                    <p className="text-xs text-zinc-500">Legal details can only be changed by the business owner.</p>
                )}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
                <h2 className="text-base font-semibold text-zinc-900">Billing contact</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Billing email">
                        <input type="email" className={inputClass} value={v.billingEmail} onChange={set("billingEmail")} disabled={!canEdit || saving} maxLength={254} />
                    </Field>
                    <Field label="Billing phone" hint="Tunisian number, for example 20 123 456">
                        <input className={inputClass} value={v.billingPhone} onChange={set("billingPhone")} disabled={!canEdit || saving} />
                    </Field>
                </div>
                <Field label="Billing address">
                    <textarea
                        className="min-h-20 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
                        value={v.billingAddress}
                        onChange={set("billingAddress")}
                        disabled={!canEdit || saving}
                        maxLength={300}
                    />
                </Field>
            </section>

            {error && (
                <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                </div>
            )}

            {canEdit ? (
                <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save changes"}
                </button>
            ) : (
                <p className="text-sm text-zinc-500">You can view these details but not change them.</p>
            )}
        </form>
    )
}
