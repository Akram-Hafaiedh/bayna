// lib/shared/governorates.ts
// The 24 governorates of Tunisia: the values the profile and application forms accept, and the
// starting point of the location map.
//
// Coordinates: taken on 16 Oct 2026 from the "Coordinates" shown on each governorate's English
// Wikipedia article (https://en.wikipedia.org/wiki/<Name>_Governorate), which gives the
// governorate's central point (usually its capital), to about 0.001 degrees (roughly 100 m).
// They are a STARTING POINT for the map pin, not a shop address: the shop moves the pin to the
// real location. Arabic names are the standard spelling of the name shown on the same articles
// (they list "ڨ" for the Tunisian pronunciation; standard Arabic "ق" is used here). Have a native
// speaker check the Arabic before it is shown to clients.
//
// `name` is the value stored in Shop.governorate and is what the application form already used.
import type { LatLng } from "@/lib/shared/geo"

export type Governorate = {
    name: string
    nameAr: string
    latitude: number
    longitude: number
}

export const GOVERNORATES: readonly Governorate[] = [
    { name: "Tunis", nameAr: "تونس", latitude: 36.8, longitude: 10.17 },
    { name: "Ariana", nameAr: "أريانة", latitude: 36.8625, longitude: 10.19556 },
    { name: "Ben Arous", nameAr: "بن عروس", latitude: 36.74722, longitude: 10.33333 },
    { name: "Manouba", nameAr: "منوبة", latitude: 36.80778, longitude: 10.10111 },
    { name: "Nabeul", nameAr: "نابل", latitude: 36.75, longitude: 10.75 },
    { name: "Zaghouan", nameAr: "زغوان", latitude: 36.4, longitude: 10.15 },
    { name: "Bizerte", nameAr: "بنزرت", latitude: 37.267, longitude: 9.867 },
    { name: "Béja", nameAr: "باجة", latitude: 36.733, longitude: 9.183 },
    { name: "Jendouba", nameAr: "جندوبة", latitude: 36.5, longitude: 8.783 },
    { name: "Kef", nameAr: "الكاف", latitude: 36.18222, longitude: 8.71472 },
    { name: "Siliana", nameAr: "سليانة", latitude: 36.167, longitude: 9.367 },
    { name: "Sousse", nameAr: "سوسة", latitude: 35.833, longitude: 10.633 },
    { name: "Monastir", nameAr: "المنستير", latitude: 35.783, longitude: 10.833 },
    { name: "Mahdia", nameAr: "المهدية", latitude: 35.5, longitude: 11.067 },
    { name: "Sfax", nameAr: "صفاقس", latitude: 34.733, longitude: 10.767 },
    { name: "Kairouan", nameAr: "القيروان", latitude: 35.667, longitude: 10.1 },
    { name: "Kasserine", nameAr: "القصرين", latitude: 35.167, longitude: 8.833 },
    { name: "Sidi Bouzid", nameAr: "سيدي بوزيد", latitude: 35.033, longitude: 9.5 },
    { name: "Gabès", nameAr: "قابس", latitude: 33.883, longitude: 10.117 },
    { name: "Medenine", nameAr: "مدنين", latitude: 33.35472, longitude: 10.50528 },
    { name: "Tataouine", nameAr: "تطاوين", latitude: 32.92556, longitude: 10.44417 },
    { name: "Gafsa", nameAr: "قفصة", latitude: 34.417, longitude: 8.783 },
    { name: "Tozeur", nameAr: "توزر", latitude: 33.917, longitude: 8.133 },
    { name: "Kebili", nameAr: "قبلي", latitude: 33.70194, longitude: 8.97361 },
]

export const GOVERNORATE_NAMES: readonly string[] = GOVERNORATES.map((g) => g.name)

/** Lower case, no accents, single spaces: "  Gabes " and "gabès" find the same governorate. */
function normalise(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
}

export function findGovernorate(name: unknown): Governorate | undefined {
    if (typeof name !== "string") return undefined
    const wanted = normalise(name)
    if (!wanted) return undefined
    return GOVERNORATES.find((g) => normalise(g.name) === wanted)
}

export function governorateCentre(g: Governorate): LatLng {
    return { latitude: g.latitude, longitude: g.longitude }
}
