// prisma/seed-demo.ts
// DEMO DATA ONLY. Creates fictional providers (with login accounts) and product
// offers linked to the shared catalogue, so search and price comparison have
// something to show. Every price here is INVENTED and is not market data.
//
// Prerequisite:  npx tsx prisma/seed.ts        (catalogue + categories)
// Run:           npx tsx prisma/seed-demo.ts
//
// Idempotent: users and providers are upserted, products are matched by
// (provider, catalogue item) and updated in place, so IDs stay stable.
// Refuses to run when NODE_ENV=production (demo accounts share a known password).
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../app/generated/prisma/client"
import { Role, Unit } from "../app/generated/prisma/enums"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_DEMO !== "1") {
    console.error(
        "Refusing to seed demo data with NODE_ENV=production. Set SEED_ALLOW_DEMO=1 to override."
    )
    process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo1234"

// ---------------------------------------------------------------------------
// Demo providers (fictional businesses, approximate city-centre coordinates)
// coverage = share of that vertical's catalogue the provider lists (0..1)
// priceFactor = how expensive the provider is relative to the others
// ---------------------------------------------------------------------------
type ProviderSeed = {
    key: string
    email: string
    userName: string
    businessName: string
    description: string
    phone: string
    address: string
    city: string
    governorate: string
    latitude: number
    longitude: number
    coverage: Record<string, number>
    priceFactor: number
}

const CONSTRUCTION = "construction-materials"
const AUTO = "auto-parts"

const PROVIDERS: ProviderSeed[] = [
    {
        key: "carthage",
        email: "carthage@demo.bayna.test",
        userName: "Demo Carthage",
        businessName: "Demo - Carthage Materials",
        description: "Demo supplier. Fictional business, fictional prices.",
        phone: "+216 00 000 001",
        address: "Demo address, Tunis",
        city: "Tunis",
        governorate: "Tunis",
        latitude: 36.8065,
        longitude: 10.1815,
        coverage: { [CONSTRUCTION]: 0.75 },
        priceFactor: 1.05,
    },
    {
        key: "sfax-btp",
        email: "sfax-btp@demo.bayna.test",
        userName: "Demo Sfax BTP",
        businessName: "Demo - Sfax BTP Centre",
        description: "Demo supplier. Fictional business, fictional prices.",
        phone: "+216 00 000 002",
        address: "Demo address, Sfax",
        city: "Sfax",
        governorate: "Sfax",
        latitude: 34.7406,
        longitude: 10.7603,
        coverage: { [CONSTRUCTION]: 0.7 },
        priceFactor: 0.92,
    },
    {
        key: "sahel",
        email: "sahel@demo.bayna.test",
        userName: "Demo Sahel",
        businessName: "Demo - Sahel Hardware & Parts",
        description: "Demo supplier selling both construction materials and auto parts.",
        phone: "+216 00 000 003",
        address: "Demo address, Sousse",
        city: "Sousse",
        governorate: "Sousse",
        latitude: 35.8256,
        longitude: 10.6084,
        coverage: { [CONSTRUCTION]: 0.5, [AUTO]: 0.4 },
        priceFactor: 1.0,
    },
    {
        key: "auto-tunis",
        email: "auto-tunis@demo.bayna.test",
        userName: "Demo Auto Tunis",
        businessName: "Demo - Tunis Auto Parts",
        description: "Demo supplier. Fictional business, fictional prices.",
        phone: "+216 00 000 004",
        address: "Demo address, Tunis",
        city: "Tunis",
        governorate: "Tunis",
        latitude: 36.8189,
        longitude: 10.1658,
        coverage: { [AUTO]: 0.75 },
        priceFactor: 1.1,
    },
    {
        key: "auto-gabes",
        email: "auto-gabes@demo.bayna.test",
        userName: "Demo Auto Gabes",
        businessName: "Demo - Gabes Auto Parts",
        description: "Demo supplier. Fictional business, fictional prices.",
        phone: "+216 00 000 005",
        address: "Demo address, Gabes",
        city: "Gabes",
        governorate: "Gabes",
        latitude: 33.8815,
        longitude: 10.0982,
        coverage: { [AUTO]: 0.7 },
        priceFactor: 0.9,
    },
]

// ---------------------------------------------------------------------------
// Invented price model (TND). Orders of magnitude only, NOT market data.
// base price = unit range x category multiplier, shared by all providers so the
// same catalogue item is comparable; each provider then applies its own factor.
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

function offerPrice(provider: ProviderSeed, base: number, itemSlug: string): string {
    const jitter = 0.96 + 0.08 * unit01(`${provider.key}:jitter:${itemSlug}`)
    const raw = base * provider.priceFactor * jitter
    const rounded = Math.max(0.05, Math.round(raw * 20) / 20) // 0.050 TND steps
    return rounded.toFixed(3) // Decimal(12,3)
}

function minOrderFor(unit: Unit): number | null {
    if (unit === Unit.BAG) return 10
    if (unit === Unit.TON) return 1
    return null
}

async function main() {
    console.log("Seeding demo providers and products (fictional data)...")

    const [categories, items] = await Promise.all([
        prisma.category.findMany(),
        prisma.catalogItem.findMany({ where: { isActive: true } }),
    ])
    if (items.length === 0) {
        throw new Error("Catalogue is empty. Run `npx tsx prisma/seed.ts` first.")
    }

    // category id -> { slug, root slug }
    const catById = new Map(categories.map((c) => [c.id, c]))
    const meta = (categoryId: string) => {
        const cat = catById.get(categoryId)
        const root = cat?.parentId ? catById.get(cat.parentId) : cat
        return { slug: cat?.slug ?? "", rootSlug: root?.slug ?? "" }
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
    const offersPerItem = new Map<string, number>()

    for (const p of PROVIDERS) {
        const user = await prisma.user.upsert({
            where: { email: p.email },
            update: { name: p.userName, role: Role.PROVIDER },
            create: {
                email: p.email,
                name: p.userName,
                password: passwordHash,
                role: Role.PROVIDER,
                emailVerified: new Date(),
            },
        })

        const providerData = {
            businessName: p.businessName,
            description: p.description,
            phone: p.phone,
            address: p.address,
            city: p.city,
            governorate: p.governorate,
            latitude: p.latitude,
            longitude: p.longitude,
            isVerified: true,
        }
        // A person can run several shops, so a shop is found by owner + name (stays idempotent)
        const existingShop = await prisma.provider.findFirst({
            where: { userId: user.id, businessName: providerData.businessName },
            select: { id: true },
        })
        const provider = existingShop
            ? await prisma.provider.update({ where: { id: existingShop.id }, data: providerData })
            : await prisma.provider.create({ data: { userId: user.id, ...providerData } })

        // Which catalogue items does this provider stock?
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
                    stock: outOfStock
                        ? 0
                        : Math.floor(unit01(`${p.key}:stock:${item.slug}`) * 400) + 1,
                    minOrderQty: minOrderFor(item.unit),
                    sku: `DEMO-${p.key.toUpperCase()}-${hash(item.slug).toString(36).toUpperCase()}`,
                    isActive: true,
                },
            ]
        })
        for (const o of offers) {
            offersPerItem.set(o.catalogItemId, (offersPerItem.get(o.catalogItemId) ?? 0) + 1)
        }

        const existing = await prisma.product.findMany({
            where: { providerId: provider.id, catalogItemId: { not: null } },
            select: { id: true, catalogItemId: true },
        })
        const existingByItem = new Map(existing.map((e) => [e.catalogItemId, e.id]))

        const toCreate = offers.filter((o) => !existingByItem.has(o.catalogItemId))
        const toUpdate = offers.filter((o) => existingByItem.has(o.catalogItemId))

        if (toCreate.length > 0) {
            await prisma.product.createMany({
                data: toCreate.map((o) => ({ providerId: provider.id, ...o })),
            })
        }
        for (const o of toUpdate) {
            await prisma.product.update({
                where: { id: existingByItem.get(o.catalogItemId)! },
                data: o,
            })
        }

        // One free-form product (no catalogue link) to exercise the optional relation
        const firstRoot = Object.keys(p.coverage)[0]
        const customCategory = categories.find(
            (c) => c.parentId && catById.get(c.parentId)?.slug === firstRoot
        )
        const customName = "Non-catalogue product (demo)"
        const custom = {
            name: customName,
            description: "Example of a provider product that is not linked to the catalogue.",
            unit: Unit.PIECE,
            price: "25.000",
            stock: 10,
            isActive: true,
            categoryId: customCategory?.id ?? null,
        }
        const existingCustom = await prisma.product.findFirst({
            where: { providerId: provider.id, catalogItemId: null, name: customName },
            select: { id: true },
        })
        if (existingCustom) {
            await prisma.product.update({ where: { id: existingCustom.id }, data: custom })
        } else {
            await prisma.product.create({ data: { providerId: provider.id, ...custom } })
        }

        console.log(`  ${p.businessName} (${p.city}): ${offers.length} catalogue offers + 1 free-form`)
    }

    const compared = [...offersPerItem.values()].filter((n) => n >= 2).length
    console.log(
        `\nDone. ${compared} of ${items.length} catalogue items have 2+ competing offers.`
    )
    console.log(`Demo provider logins (password: ${DEMO_PASSWORD}):`)
    for (const p of PROVIDERS) console.log(`  ${p.email}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })