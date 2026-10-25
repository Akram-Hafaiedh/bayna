// prisma/seed/seeders/shops.ts
// The demo shops and their owner accounts: the data (each shop has an owner, belongs to a company from
// businesses.ts by name, and lists a share of the catalogue at its own price level) and the seeder. A shop
// is found by owner + name, so running twice updates it in place. Shops are approved (status ACTIVE). Who may
// do what in them comes from the `access` seeder. Everything here is fictional.
import bcrypt from "bcryptjs"
import { SEED_PASSWORD, SeedError, type Seeder } from "../core"

export const CONSTRUCTION = "construction-materials"
export const AUTO = "auto-parts"

export type ShopSeed = {
    /** Stable key; also seeds the pseudo-random offers, so changing it changes that shop's prices */
    key: string
    ownerEmail: string
    ownerName: string
    /** Name of the company (Business) the shop belongs to: must exist in COMPANIES */
    company: string
    /** The shop's own name */
    name: string
    description: string
    phone: string
    address: string
    city: string
    governorate: string
    latitude: number
    longitude: number
    /** share (0..1) of each vertical's catalogue the shop lists, by root category slug */
    coverage: Record<string, number>
    /** how expensive the shop is relative to the others */
    priceFactor: number
}

export const SHOPS: ShopSeed[] = [
    {
        key: "carthage",
        ownerEmail: "carthage@demo.bayna.test",
        ownerName: "Demo Carthage",
        company: "Demo - Carthage Group SARL",
        name: "Demo - Carthage Materials",
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
        // A second shop of the same owner and company, so the demo shows one business with two shops
        key: "carthage-marsa",
        ownerEmail: "carthage@demo.bayna.test",
        ownerName: "Demo Carthage",
        company: "Demo - Carthage Group SARL",
        name: "Demo - Carthage Materials La Marsa",
        description: "Demo supplier. Fictional business, fictional prices.",
        phone: "+216 00 000 006",
        address: "Demo address, La Marsa",
        city: "La Marsa",
        governorate: "Tunis",
        latitude: 36.8782,
        longitude: 10.3247,
        coverage: { [CONSTRUCTION]: 0.55 },
        priceFactor: 1.12,
    },
    {
        key: "sfax-btp",
        ownerEmail: "sfax-btp@demo.bayna.test",
        ownerName: "Demo Sfax BTP",
        company: "Demo - Sfax BTP SUARL",
        name: "Demo - Sfax BTP Centre",
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
        ownerEmail: "sahel@demo.bayna.test",
        ownerName: "Demo Sahel",
        company: "Demo - Sahel Trading SARL",
        name: "Demo - Sahel Hardware & Parts",
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
        ownerEmail: "auto-tunis@demo.bayna.test",
        ownerName: "Demo Auto Tunis",
        company: "Demo - Tunis Auto Group",
        name: "Demo - Tunis Auto Parts",
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
        ownerEmail: "auto-gabes@demo.bayna.test",
        ownerName: "Demo Auto Gabes",
        company: "Demo - Gabes Auto SARL",
        name: "Demo - Gabes Auto Parts",
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
// The seeder
// ---------------------------------------------------------------------------

export const shops: Seeder = {
    name: "shops",
    kind: "demo",
    description: "Demo shops with their owner accounts",
    needs: ["businesses"],
    async run({ prisma, log }) {
        const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)
        for (const s of SHOPS) {
            const company = await prisma.business.findFirst({ where: { name: s.company, deletedAt: null }, select: { id: true } })
            if (!company) throw new SeedError(`Company "${s.company}" is missing. Run: npm run seed businesses`)

            const owner = await prisma.user.upsert({
                where: { email: s.ownerEmail },
                update: { name: s.ownerName, role: "PROVIDER" },
                create: { email: s.ownerEmail, name: s.ownerName, password: passwordHash, role: "PROVIDER", emailVerified: new Date() },
                select: { id: true },
            })

            const data = {
                businessId: company.id,
                name: s.name,
                description: s.description,
                phone: s.phone,
                address: s.address,
                city: s.city,
                governorate: s.governorate,
                latitude: s.latitude,
                longitude: s.longitude,
                status: "ACTIVE" as const,
            }
            const existing = await prisma.shop.findFirst({ where: { userId: owner.id, name: s.name }, select: { id: true } })
            if (existing) await prisma.shop.update({ where: { id: existing.id }, data })
            else await prisma.shop.create({ data: { userId: owner.id, ...data } })
            log(`${s.name} (${s.city}) in ${s.company}`)
        }
        return `${SHOPS.length} shops, owners log in with password ${SEED_PASSWORD}`
    },
}
