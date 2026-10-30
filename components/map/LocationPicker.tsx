"use client"
// components/map/LocationPicker.tsx
// Lets a shop owner put their shop on the map: click the map or drag the pin, search an address,
// or use their current position. It starts from the governorate centre. The parent keeps the state.
import { useState } from "react"
import dynamic from "next/dynamic"
import { isInTunisia, type LatLng } from "@/lib/shared/geo"
import type { LocationMapProps } from "./LocationMap"

const LocationMap = dynamic<LocationMapProps>(() => import("./LocationMap"), {
    ssr: false,
    loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-zinc-100" />,
})

export type PinSource = "PIN" | "GEOCODED"

type Props = {
    /** Centre of the chosen governorate (where the map starts), or null before one is chosen */
    centre: LatLng | null
    pin: LatLng | null
    /** Text to search for, usually address + city + governorate */
    searchText: string
    onChange: (point: LatLng, source: PinSource) => void
    disabled?: boolean
}

const TUNISIA_CENTRE: LatLng = { latitude: 34.0, longitude: 9.5 }
const btn =
    "h-9 px-3 rounded-lg border border-zinc-250 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"

export default function LocationPicker({ centre, pin, searchText, onChange, disabled }: Props) {
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState("")

    function pick(point: LatLng, source: PinSource) {
        if (disabled) return
        if (!isInTunisia(point)) {
            setNote("That spot is outside Tunisia.")
            return
        }
        setNote("")
        onChange(point, source)
    }

    async function search() {
        const q = searchText.trim()
        if (!q) {
            setNote("Type an address first.")
            return
        }
        setBusy(true)
        setNote("")
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tn&q=${encodeURIComponent(q)}`
            const res = await fetch(url, { headers: { Accept: "application/json" } })
            const rows = (await res.json()) as { lat: string; lon: string }[]
            if (!rows.length) {
                setNote("Address not found. Click the map to place the pin yourself.")
                return
            }
            pick({ latitude: Number(rows[0].lat), longitude: Number(rows[0].lon) }, "GEOCODED")
            setNote("Found. Drag the pin if it is not exactly on your shop.")
        } catch {
            setNote("Search is not available right now. Click the map to place the pin.")
        } finally {
            setBusy(false)
        }
    }

    function useMyLocation() {
        if (!navigator.geolocation) {
            setNote("Your browser cannot share its location.")
            return
        }
        setBusy(true)
        setNote("")
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setBusy(false)
                pick({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, "PIN")
            },
            () => {
                setBusy(false)
                setNote("Could not get your location. Click the map instead.")
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={search} disabled={disabled || busy} className={btn}>
                    Find my address on the map
                </button>
                <button type="button" onClick={useMyLocation} disabled={disabled || busy} className={btn}>
                    Use my current location
                </button>
            </div>
            <LocationMap
                centre={centre ?? TUNISIA_CENTRE}
                pin={pin}
                zoom={centre || pin ? undefined : 6}
                onPick={disabled ? undefined : (p) => pick(p, "PIN")}
            />
            <p className="text-xs text-zinc-500">
                {pin
                    ? `Pin at ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}. Click the map or drag the pin to adjust it.`
                    : "Choose a governorate, then click the map to place your shop."}
            </p>
            {note && <p className="text-xs text-amber-700">{note}</p>}
        </div>
    )
}
