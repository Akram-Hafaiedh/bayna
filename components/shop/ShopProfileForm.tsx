"use client"
// components/shop/ShopProfileForm.tsx
// One form for the shop application (/become-shop) and the shop profile (/shop/<publicShopId>/profile).
// It collects the essentials; the parent decides where the body is sent.
import { useState } from "react"
import { GOVERNORATES, findGovernorate } from "@/lib/shared/governorates"
import { formatPhone } from "@/lib/shops/shop-input"
import type { LatLng } from "@/lib/shared/geo"
import LocationPicker, { type PinSource } from "@/components/map/LocationPicker"

export type ProfileValues = {
    name: string
    description: string
    phone: string
    whatsapp: string
    address: string
    city: string
    governorate: string
    latitude: number | null
    longitude: number | null
    /** LOOKUP, PIN, GEOCODED, IMPORTED or null: how the saved pin was set */
    locationSource: string | null
}

export const EMPTY_PROFILE: ProfileValues = {
    name: "",
    description: "",
    phone: "",
    whatsapp: "",
    address: "",
    city: "",
    governorate: "",
    latitude: null,
    longitude: null,
    locationSource: null,
}

type Props = {
    initial: ProfileValues
    submitLabel: string
    /** Returns an error message, or null when saved */
    onSubmit: (body: Record<string, unknown>) => Promise<string | null>
    /** Shown above the buttons, e.g. the notice that name/address changes are reviewed */
    notice?: React.ReactNode
    disabled?: boolean
    /**
     * Two columns on wide screens: shop and location on the left, contact (and `children`) on the right.
     * Meant for pages that already have the full width, such as a shop in the Business area. On a phone
     * the order stays shop, contact, location, then the save button.
     */
    wide?: boolean
    children?: React.ReactNode
}

const input =
    "w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-500"
const label = "block text-sm font-medium text-zinc-700"
const card = "rounded-xl border border-zinc-200 bg-white p-6 space-y-5"

function Field({ title, required, hint, children }: { title: string; required?: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className={label}>
                {title} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {hint && <p className="text-xs text-zinc-500">{hint}</p>}
        </div>
    )
}

export default function ShopProfileForm({ initial, submitLabel, onSubmit, notice, disabled, wide, children }: Props) {
    const [v, setV] = useState<ProfileValues>({
        ...initial,
        phone: initial.phone ? formatPhone(initial.phone) : "",
        whatsapp: initial.whatsapp ? formatPhone(initial.whatsapp) : "",
    })
    // True once the person placed the pin themselves: only then is the pin sent to the server
    const [pinTouched, setPinTouched] = useState(false)
    const [source, setSource] = useState<PinSource>("PIN")
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    const gov = findGovernorate(v.governorate)
    const centre: LatLng | null = gov ? { latitude: gov.latitude, longitude: gov.longitude } : null
    const pin: LatLng | null = v.latitude != null && v.longitude != null ? { latitude: v.latitude, longitude: v.longitude } : null

    function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
        setV((prev) => ({ ...prev, [key]: value }))
    }

    function chooseGovernorate(name: string) {
        const g = findGovernorate(name)
        setV((prev) => {
            // A pin the person did not place this session follows the governorate centre
            // (the server does the same when the governorate changes without a pin)
            const follows = !pinTouched && prev.governorate !== name
            return {
                ...prev,
                governorate: name,
                ...(g && follows ? { latitude: g.latitude, longitude: g.longitude, locationSource: "LOOKUP" } : {}),
            }
        })
    }

    function placePin(p: LatLng, s: PinSource) {
        setPinTouched(true)
        setSource(s)
        setV((prev) => ({ ...prev, latitude: p.latitude, longitude: p.longitude, locationSource: s }))
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (disabled) return
        setError("")
        setSaving(true)
        const body: Record<string, unknown> = {
            name: v.name,
            description: v.description,
            phone: v.phone,
            whatsapp: v.whatsapp,
            address: v.address,
            city: v.city,
            governorate: v.governorate,
        }
        if (pinTouched && pin) {
            body.latitude = pin.latitude
            body.longitude = pin.longitude
            body.locationSource = source
        }
        try {
            const message = await onSubmit(body)
            if (message) setError(message)
        } catch {
            setError("Something went wrong")
        } finally {
            setSaving(false)
        }
    }

    const searchText = [v.address, v.city, v.governorate, "Tunisia"].filter((x) => x.trim()).join(", ")

    // Wide: a two-column grid on large screens, each block placed by hand so the phone order stays natural
    const form = wide ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : "space-y-6"
    const shopPlace = wide ? "lg:col-start-1 lg:row-start-1" : ""
    const contactPlace = wide ? "lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:space-y-5" : ""
    const locationPlace = wide ? "lg:col-start-1 lg:row-start-2" : ""
    const actionsPlace = wide ? "lg:col-start-1 lg:row-start-3" : ""

    return (
        <form onSubmit={submit} className={form}>
            <section className={`${card} ${shopPlace}`}>
                <h2 className="text-base font-semibold text-zinc-900">Your shop</h2>
                <Field title="Shop name" required>
                    <input required disabled={disabled} type="text" maxLength={120} placeholder="e.g. Auto Parts Sousse" value={v.name} onChange={(e) => set("name", e.target.value)} className={input} />
                </Field>
                <Field title="Description" hint="What you sell and what makes your shop different. Customers see this.">
                    <textarea rows={4} disabled={disabled} maxLength={2000} placeholder="What do you sell?" value={v.description} onChange={(e) => set("description", e.target.value)} className={`${input} h-auto py-2.5 resize-none`} />
                </Field>
            </section>

            <div className={`space-y-6 ${contactPlace}`}>
                <section className={card}>
                    <h2 className="text-base font-semibold text-zinc-900">Contact</h2>
                    <div className={`grid gap-4 ${wide ? "sm:grid-cols-2 lg:grid-cols-1" : "sm:grid-cols-2"}`}>
                        <Field title="Phone" required hint="Tunisian number, for example 20 123 456">
                            <input required disabled={disabled} type="tel" placeholder="+216 20 123 456" value={v.phone} onChange={(e) => set("phone", e.target.value)} className={input} />
                        </Field>
                        <Field title="WhatsApp" hint="Optional. Leave empty if it is the same number.">
                            <input disabled={disabled} type="tel" placeholder="+216 20 123 456" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={input} />
                        </Field>
                    </div>
                </section>
                {wide && children}
            </div>

            <section className={`${card} ${locationPlace}`}>
                <h2 className="text-base font-semibold text-zinc-900">Location</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field title="Governorate" required>
                        <select required disabled={disabled} value={v.governorate} onChange={(e) => chooseGovernorate(e.target.value)} className={input}>
                            <option value="">Select...</option>
                            {GOVERNORATES.map((g) => (
                                <option key={g.name} value={g.name}>
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field title="City" required>
                        <input required disabled={disabled} type="text" maxLength={80} placeholder="e.g. Sousse" value={v.city} onChange={(e) => set("city", e.target.value)} className={input} />
                    </Field>
                </div>
                <Field title="Address" hint="Street, building, landmark">
                    <input disabled={disabled} type="text" maxLength={200} placeholder="Street, building..." value={v.address} onChange={(e) => set("address", e.target.value)} className={input} />
                </Field>
                <div className="space-y-1.5">
                    <p className={label}>Pin your shop on the map</p>
                    <LocationPicker centre={centre} pin={pin} searchText={searchText} onChange={placePin} disabled={disabled} />
                    {pin && !pinTouched && v.locationSource === "LOOKUP" && (
                        <p className="text-xs text-amber-700">
                            This is only the centre of the governorate. Move the pin onto your shop so customers can find you.
                        </p>
                    )}
                </div>
            </section>

            {!wide && children}

            <div className={`space-y-6 ${actionsPlace}`}>
                {notice && <div className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{notice}</div>}

                {error && <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">{error}</div>}

                <button type="submit" disabled={saving || disabled} className="h-11 px-5 rounded-lg bg-zinc-900 text-white text-[15px] font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? "Saving..." : submitLabel}
                </button>
            </div>
        </form>
    )
}
