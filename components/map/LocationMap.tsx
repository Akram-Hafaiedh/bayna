"use client"
// components/map/LocationMap.tsx
// The Leaflet map itself. Loaded only in the browser (see LocationPicker, which imports it with
// next/dynamic and ssr:false), because Leaflet needs `window`.
// Props are plain data so the same component can later show many shops on the public map.
import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import type { LatLng } from "@/lib/geo"

const PIN = L.divIcon({
    className: "",
    html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#18181b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
})

let mounts = 0

export type LocationMapProps = {
    /** Where the map is centred when there is no pin yet */
    centre: LatLng
    /** The current pin, or null */
    pin: LatLng | null
    /** Zoom to use when the view moves to a new place */
    zoom?: number
    /** Called with the new position when the pin is clicked into place or dragged */
    onPick?: (point: LatLng) => void
    height?: number
}

function Clicks({ onPick }: { onPick?: (p: LatLng) => void }) {
    useMapEvents({
        click(e) {
            onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng })
        },
    })
    return null
}

/** Moves the view when the pin or the centre changes from outside (search, governorate, my location). */
function Follow({ target, zoom }: { target: LatLng; zoom: number }) {
    const map = useMap()
    const last = useRef<string>("")
    useEffect(() => {
        const key = `${target.latitude.toFixed(5)},${target.longitude.toFixed(5)},${zoom}`
        if (key === last.current) return
        last.current = key
        map.setView([target.latitude, target.longitude], zoom, { animate: true })
    }, [map, target, zoom])
    return null
}

export default function LocationMap({ centre, pin, zoom, onPick, height = 320 }: LocationMapProps) {
    // Leaflet takes over a DOM node and cannot be re-attached once React hides or re-shows the page
    // (Strict Mode, and Next cached pages when you navigate away and back). So the map is created
    // only while the component is shown, with a fresh key each time.
    const [instance, setInstance] = useState(0)
    useEffect(() => {
        setInstance(++mounts) // a number never used before, so the old map is never reused
        return () => setInstance(0)
    }, [])

    const target = pin ?? centre
    const z = zoom ?? (pin ? 15 : 9)
    const handlers = useMemo(
        () => ({
            dragend(e: L.LeafletEvent) {
                const ll = (e.target as L.Marker).getLatLng()
                onPick?.({ latitude: ll.lat, longitude: ll.lng })
            },
        }),
        [onPick]
    )

    if (instance === 0) return <div style={{ height, width: "100%", borderRadius: 8 }} className="animate-pulse bg-zinc-100" />

    return (
        <MapContainer
            key={instance}
            center={[target.latitude, target.longitude]}
            zoom={z}
            scrollWheelZoom={false}
            style={{ height, width: "100%", borderRadius: 8, zIndex: 0 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Clicks onPick={onPick} />
            <Follow target={target} zoom={z} />
            {pin && (
                <Marker
                    position={[pin.latitude, pin.longitude]}
                    icon={PIN}
                    draggable={!!onPick}
                    eventHandlers={handlers}
                />
            )}
        </MapContainer>
    )
}
