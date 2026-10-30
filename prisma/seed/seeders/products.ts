// prisma/seed/seeders/products.ts
// The demo offers: each shop lists a share of the catalogue at its own price level, plus one product that is
// not in the catalogue. Prices are INVENTED (the price model below), never market data. Offers are matched by
// (shop, catalogue item), so running twice updates in place and the ids stay stable.
import { ProductStatus, Unit } from "../../../app/generated/prisma/enums"
import { SeedError, type Seeder } from "../core"
import { SHOPS } from "./shops"

// ---------------------------------------------------------------------------
// Invented price model (TND). Orders of magnitude only, NOT market data.
// base price = unit range x category multiplier, shared by all shops so the same catalogue item is
// comparable; each shop then applies its own priceFactor. Deterministic: same inputs, same prices.
// ---------------------------------------------------------------------------

const UNIT_RANGE: Record<Unit, [number, number]> = {
    PIECE: [2, 60],
    BAG: [8, 35],
    METER: [1.5, 25],
    SQUARE_METER: [12, 90],
    CUBIC_METER: [35, 110],
    ROLL: [20, 85],
    LITER: [4, 30],
    TON: [300, 600],
    OTHER: [5, 40],
}

const CATEGORY_MULT: Record<string, number> = {
    "bricks-blocks-masonry": 0.12,
    "fixings-hardware": 0.08,
    "paint-decoration": 1.8,
    "plumbing-sanitary": 3,
    electrical: 1.5,
    "doors-windows-joinery": 12,
    "wood-site-carpentry": 1.4,
    "tools-site-equipment": 4,
    "waterproofing-insulation": 1.2,
    "tiles-coverings": 1.1,
    "roofing-facade-exterior": 1.3,
    "auto-brakes": 4,
    "auto-filters": 1.5,
    "auto-engine-timing": 5,
    "auto-cooling-heating": 6,
    "auto-oils-fluids": 1.2,
    "auto-suspension-steering": 7,
    "auto-clutch-transmission": 12,
    "auto-electrical-lighting": 3,
    "auto-exhaust": 8,
    "auto-tyres-wheels": 25,
    "auto-body-accessories": 7,
}

// Deterministic pseudo-randomness: same inputs always give the same demo data.
function hash(text: string): number {
    let h = 2166136261
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}
const unit01 = (text: string) => hash(text) / 4294967295

function basePrice(item: { slug: string; name: string; unit: Unit }, categorySlug: string): number {
    let [min, max] = UNIT_RANGE[item.unit]
    if (item.name.startsWith("Rebar")) [min, max] = [2000, 2600] // per ton
    else if (item.unit !== Unit.TON) {
        const mult = CATEGORY_MULT[categorySlug] ?? 1
        min *= mult
        max *= mult
    }
    return min + (max - min) * Math.pow(unit01(`price:${item.slug}`), 1.5)
}

function offerPrice(shop: { key: string; priceFactor: number }, base: number, itemSlug: string): string {
    const jitter = 0.96 + 0.08 * unit01(`${shop.key}:jitter:${itemSlug}`)
    const raw = base * shop.priceFactor * jitter
    const rounded = Math.max(0.05, Math.round(raw * 20) / 20) // 0.050 TND steps
    return rounded.toFixed(3) // Decimal(12,3)
}

function minOrderFor(unit: Unit): number | null {
    if (unit === Unit.BAG) return 10
    if (unit === Unit.TON) return 1
    return null
}

// ---------------------------------------------------------------------------
// The seeder
// ---------------------------------------------------------------------------

export const products: Seeder = {
    name: "products",
    kind: "demo",
    description: "Demo product offers for every shop",
    needs: ["catalogue", "shops"],
    async run({ prisma, log }) {
        const [categories, items] = await Promise.all([
            prisma.category.findMany(),
            prisma.catalogItem.findMany({ where: { isActive: true } }),
        ])
        if (items.length === 0) throw new SeedError("The catalogue is empty. Run: npm run seed categories,catalogue")

        const catById = new Map(categories.map((c) => [c.id, c]))
        const meta = (categoryId: string) => {
            const cat = catById.get(categoryId)
            const root = cat?.parentId ? catById.get(cat.parentId) : cat
            return { slug: cat?.slug ?? "", rootSlug: root?.slug ?? "" }
        }

        const offersPerItem = new Map<string, number>()
        let totalOffers = 0

        for (const p of SHOPS) {
            const shop = await prisma.shop.findFirst({
                where: { name: p.name, applicant: { email: p.ownerEmail }, deletedAt: null },
                select: { id: true },
            })
            if (!shop) throw new SeedError(`Shop "${p.name}" is missing. Run: npm run seed shops`)

            // Which catalogue items does this shop stock?
            const offers = items.flatMap((item) => {
                const { slug: categorySlug, rootSlug } = meta(item.categoryId)
                const coverage = p.coverage[rootSlug]
                if (coverage === undefined) return []
                if (unit01(`${p.key}:has:${item.slug}`) >= coverage) return []

                const outOfStock = unit01(`${p.key}:oos:${item.slug}`) < 0.08
                return [
                    {
                        catalogItemId: item.id,
                        name: item.name,
                        unit: item.unit,
                        categoryId: item.categoryId,
                        price: offerPrice(p, basePrice(item, categorySlug), item.slug),
                        stock: outOfStock ? 0 : Math.floor(unit01(`${p.key}:stock:${item.slug}`) * 400) + 1,
                        minOrderQty: minOrderFor(item.unit),
                        sku: `DEMO-${p.key.toUpperCase()}-${hash(item.slug).toString(36).toUpperCase()}`,
                        status: ProductStatus.ACTIVE,
                    },
                ]
            })
            for (const o of offers) offersPerItem.set(o.catalogItemId, (offersPerItem.get(o.catalogItemId) ?? 0) + 1)

            const existing = await prisma.product.findMany({
                where: { shopId: shop.id, catalogItemId: { not: null } },
                select: { id: true, catalogItemId: true },
            })
            const existingByItem = new Map(existing.map((e) => [e.catalogItemId, e.id]))
            const toCreate = offers.filter((o) => !existingByItem.has(o.catalogItemId))
            const toUpdate = offers.filter((o) => existingByItem.has(o.catalogItemId))

            if (toCreate.length > 0) {
                await prisma.product.createMany({ data: toCreate.map((o) => ({ shopId: shop.id, ...o })) })
            }
            for (const o of toUpdate) {
                await prisma.product.update({ where: { id: existingByItem.get(o.catalogItemId)! }, data: o })
            }

            // One free-form product (no catalogue link) to exercise the optional relation
            const firstRoot = Object.keys(p.coverage)[0]
            const customCategory = categories.find((c) => c.parentId && catById.get(c.parentId)?.slug === firstRoot)
            const customName = "Non-catalogue product (demo)"
            const custom = {
                name: customName,
                description: "Example of a shop product that is not linked to the catalogue.",
                unit: Unit.PIECE,
                price: "25.000",
                stock: 10,
                status: ProductStatus.ACTIVE,
                categoryId: customCategory?.id ?? null,
            }
            const existingCustom = await prisma.product.findFirst({
                where: { shopId: shop.id, catalogItemId: null, name: customName },
                select: { id: true },
            })
            if (existingCustom) await prisma.product.update({ where: { id: existingCustom.id }, data: custom })
            else await prisma.product.create({ data: { shopId: shop.id, ...custom } })

            totalOffers += offers.length
            log(`${p.name}: ${offers.length} catalogue offers + 1 free-form`)
        }

        const compared = [...offersPerItem.values()].filter((n) => n >= 2).length
        return `${totalOffers} offers; ${compared} of ${items.length} catalogue items have 2+ competing offers`
    },
}
