// lib/shared/geo.ts
// Small geography helpers. Pure and dependency-free. Also used by the price comparison and travel
// cost features (Phase 4).

export type LatLng = { latitude: number; longitude: number }

/**
 * Rough bounding box around Tunisia. It also covers some sea and a little of Algeria and Libya, so
 * it only catches impossible values (swapped numbers, 0/0, a pin on another continent), not
 * "slightly over the border".
 */
export const TUNISIA_BOUNDS = { south: 30.2, north: 37.6, west: 7.5, east: 11.7 } as const

export function isInTunisia(point: LatLng): boolean {
    const { latitude: lat, longitude: lng } = point
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= TUNISIA_BOUNDS.south &&
        lat <= TUNISIA_BOUNDS.north &&
        lng >= TUNISIA_BOUNDS.west &&
        lng <= TUNISIA_BOUNDS.east
    )
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in kilometres (haversine). Straight line, not driving distance. */
export function distanceKm(a: LatLng, b: LatLng): number {
    const rad = (d: number) => (d * Math.PI) / 180
    const dLat = rad(b.latitude - a.latitude)
    const dLng = rad(b.longitude - a.longitude)
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
