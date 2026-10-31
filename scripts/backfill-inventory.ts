// scripts/backfill-inventory.ts
// For a database that already holds shops and products from before warehouses existed: gives every shop its
// default warehouse (from its address and pin) and turns each product's `stock` into a stock level there,
// with an "Opening stock" row in the ledger. Safe to run again: a product that already has a level in the
// default warehouse is skipped.
//
//   npm run db:backfill-inventory
import "dotenv/config"
import { prisma } from "../lib/prisma"

async function main() {
    const shops = await prisma.shop.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, address: true, city: true, governorate: true, latitude: true, longitude: true, locationSource: true },
    })
    let warehouses = 0
    let levels = 0
    for (const shop of shops) {
        let main = await prisma.warehouse.findFirst({ where: { shopId: shop.id, isDefault: true, archivedAt: null }, select: { id: true } })
        if (!main) {
            main = await prisma.warehouse.create({
                data: {
                    shopId: shop.id, name: "Main warehouse", isDefault: true, address: shop.address, city: shop.city, governorate: shop.governorate,
                    latitude: shop.latitude, longitude: shop.longitude, locationSource: shop.locationSource,
                },
                select: { id: true },
            })
            warehouses++
        }
        const products = await prisma.product.findMany({
            where: { shopId: shop.id, stockLevels: { none: { warehouseId: main.id } } },
            select: { id: true, stock: true },
        })
        if (products.length === 0) continue
        const warehouseId = main.id
        await prisma.stockLevel.createMany({ data: products.map((p) => ({ productId: p.id, warehouseId, quantity: p.stock })) })
        await prisma.stockMovement.createMany({
            data: products.filter((p) => p.stock > 0).map((p) => ({
                shopId: shop.id, warehouseId, productId: p.id, type: "RECEIVED" as const, quantity: p.stock, balanceAfter: p.stock, reasonCode: "OPENING_STOCK",
            })),
        })
        levels += products.length
        console.log(`${shop.name}: ${products.length} products`)
    }
    console.log(`Done: ${warehouses} warehouses created, ${levels} stock levels.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
