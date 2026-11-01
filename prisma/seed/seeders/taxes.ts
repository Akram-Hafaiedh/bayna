// prisma/seed/seeders/taxes.ts
// Placeholder taxes for the demo shops, so the Taxes page, the HT / TTC prices and the "tax to set" list have
// something to show. THESE ARE NOT THE REAL TUNISIAN RATES (they must be confirmed with an accountant first),
// so every name says Demo. Per shop: a 1% tax on the price, a 19% tax on the running total, and (first shop
// only) a fixed amount per unit. About six products in ten get the percentage taxes, one in ten is marked tax
// exempt, the rest are left "to set". Safe to run again: a product that already has taxes, or is exempt, is
// skipped. Prices are worked out with the same code the app uses (lib/pricing).
import { SeedError, type Seeder } from "../core"
import { recomputeProducts } from "../../../lib/pricing/price-actions"

const TAXES = [
    { name: "Demo - Tax A 1%", kind: "PERCENTAGE", value: "1", appliesOn: "BASE", onlyFirstShop: false },
    { name: "Demo - Tax B 19%", kind: "PERCENTAGE", value: "19", appliesOn: "RUNNING", onlyFirstShop: false },
    { name: "Demo - Fixed 0.500 per unit", kind: "FIXED", value: "0.5", appliesOn: "BASE", onlyFirstShop: true },
] as const

export const taxes: Seeder = {
    name: "taxes",
    kind: "demo",
    description: "Placeholder taxes on the demo shops' products (not real rates)",
    needs: ["shops", "products"],
    async run({ prisma }) {
        const shops = await prisma.shop.findMany({
            where: { deletedAt: null, status: "ACTIVE", name: { startsWith: "Demo - " } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        })
        if (shops.length === 0) throw new SeedError("There are no demo shops. Run: npm run seed shops,products")

        let created = 0
        let attached = 0
        let exempt = 0
        for (const [shopIndex, shop] of shops.entries()) {
            const ids: string[] = []
            for (const [i, t] of TAXES.entries()) {
                if (t.onlyFirstShop && shopIndex > 0) continue
                const found = await prisma.taxRate.findFirst({ where: { shopId: shop.id, name: t.name }, select: { id: true } })
                if (found) { ids.push(found.id); continue }
                const row = await prisma.taxRate.create({
                    data: { shopId: shop.id, name: t.name, kind: t.kind, value: t.value, appliesOn: t.appliesOn, sortOrder: i },
                    select: { id: true },
                })
                ids.push(row.id)
                created++
            }

            const products = await prisma.product.findMany({
                where: { shopId: shop.id, deletedAt: null, taxExempt: false, taxes: { none: {} } },
                orderBy: { id: "asc" },
                select: { id: true },
            })
            const exemptIds: string[] = []
            const links: { productId: string; taxRateId: string }[] = []
            for (const [i, p] of products.entries()) {
                const slot = i % 10
                if (slot < 6) for (const taxRateId of ids.slice(0, shopIndex === 0 ? 3 : 2)) links.push({ productId: p.id, taxRateId })
                else if (slot === 6) exemptIds.push(p.id)
            }
            if (links.length > 0) await prisma.productTax.createMany({ data: links, skipDuplicates: true })
            if (exemptIds.length > 0) await prisma.product.updateMany({ where: { id: { in: exemptIds } }, data: { taxExempt: true } })
            attached += new Set(links.map((l) => l.productId)).size
            exempt += exemptIds.length
            await prisma.$transaction((tx) => recomputeProducts(tx, shop.id), { timeout: 120_000 })
        }
        return `${created} taxes created, ${attached} products taxed, ${exempt} marked exempt`
    },
}
