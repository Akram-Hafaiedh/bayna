// lib/shop-setup.ts
// What is still missing from a shop's details, for the setup checklist on the shop's page in the Business
// area. A shop can be created with the essentials; the rest is filled in over time. Pure (unit tested).

export type ShopSetupInput = {
    description: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
    city: string | null
    governorate: string | null
    latitude: number | null
    longitude: number | null
    isVerified: boolean
}

export type SetupItem = { key: string; label: string; done: boolean; hint: string; optional?: boolean }

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0

export function shopSetup(shop: ShopSetupInput): { items: SetupItem[]; missing: number; complete: boolean } {
    const items: SetupItem[] = [
        { key: "phone", label: "Phone number", done: filled(shop.phone), hint: "Customers call this number." },
        { key: "place", label: "City and governorate", done: filled(shop.city) && filled(shop.governorate), hint: "Where the shop is." },
        { key: "address", label: "Street address", done: filled(shop.address), hint: "So customers can find the door." },
        { key: "pin", label: "Pin on the map", done: shop.latitude != null && shop.longitude != null, hint: "Used for distance and travel cost." },
        { key: "description", label: "Short description", done: filled(shop.description), hint: "What the shop sells, in a sentence or two." },
        { key: "whatsapp", label: "WhatsApp number", done: filled(shop.whatsapp), hint: "Optional, handy for quick questions.", optional: true },
    ]
    const missing = items.filter((i) => !i.done && !i.optional).length
    return { items, missing, complete: missing === 0 && shop.isVerified }
}
