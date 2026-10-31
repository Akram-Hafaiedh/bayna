// prisma/seed/seeders/inventory.ts
// Warehouses and stock levels for the demo shops. Every shop gets its default warehouse (from its own address
// and pin) holding the stock its products already have, with an "Opening stock" row in the ledger; the main
// Carthage shop also gets a second warehouse with part of its stock transferred there, so the transfer
// history and the multi-warehouse screens have something to show. Safe to run again: a product that already
// has a level in the default warehouse is skipped. Writes in bulk (createMany), not through withAudit.
import { SeedError, type Seeder } from "../core"
import { SHOP_NAMES } from "./users"

const SECOND_WAREHOUSE = {
    shop: SHOP_NAMES.tunis,
    name: "Demo - Ben Arous depot",
    address: "Demo address, Ben Arous",
    city: "Ben Arous",
    governorate: "Ben Arous",
    latitude: 36.7531,
    longitude: 10.2189,
}
/** How many of the shop's products are spread over the second warehouse, and the share that moves */
const TRANSFERRED_PRODUCTS = 25
const TRANSFER_SHARE = 0.4

export const inventory: Seeder = {
    name: "inventory",
    kind: "demo",
    description: "Default warehouses with the shops' stock, and a second warehouse in one shop",
    needs: ["products"],
    async run({ prisma, log }) {
        const shops = await prisma.shop.findMany({
            where: { deletedAt: null, status: "ACTIVE", name: { startsWith: "Demo - " } },
            select: { id: true, name: true, address: true, city: true, governorate: true, latitude: true, longitude: true, locationSource: true },
            orderBy: { name: "asc" },
        })
        if (shops.length === 0) throw new SeedError("There are no demo shops. Run: npm run seed shops,products")

        let warehouses = 0
        let levels = 0
        let transfers = 0
        for (const shop of shops) {
            let main = await prisma.warehouse.findFirst({ where: { shopId: shop.id, isDefault: true, archivedAt: null }, select: { id: true } })
            if (!main) {
                main = await prisma.warehouse.create({
                    data: {
                        shopId: shop.id, name: "Main warehouse", isDefault: true,
                        address: shop.address, city: shop.city, governorate: shop.governorate,
                        latitude: shop.latitude, longitude: shop.longitude, locationSource: shop.locationSource,
                    },
                    select: { id: true },
                })
                warehouses++
            }

            // Products that have no level in the main warehouse yet: their current stock becomes the opening stock
            const products = await prisma.product.findMany({
                where: { shopId: shop.id, deletedAt: null, stockLevels: { none: { warehouseId: main.id } } },
                select: { id: true, stock: true },
            })
            if (products.length > 0) {
                await prisma.stockLevel.createMany({
                    data: products.map((p) => ({ productId: p.id, warehouseId: main!.id, quantity: p.stock })),
                })
                await prisma.stockMovement.createMany({
                    data: products
                        .filter((p) => p.stock > 0)
                        .map((p) => ({
                            shopId: shop.id, warehouseId: main!.id, productId: p.id, type: "RECEIVED" as const,
                            quantity: p.stock, balanceAfter: p.stock, reasonCode: "OPENING_STOCK",
                        })),
                })
                levels += products.length
            }

            if (shop.name !== SECOND_WAREHOUSE.shop) continue
            const exists = await prisma.warehouse.findFirst({ where: { shopId: shop.id, name: SECOND_WAREHOUSE.name }, select: { id: true } })
            if (exists) continue
            const second = await prisma.warehouse.create({
                data: {
                    shopId: shop.id, name: SECOND_WAREHOUSE.name, isDefault: false,
                    address: SECOND_WAREHOUSE.address, city: SECOND_WAREHOUSE.city, governorate: SECOND_WAREHOUSE.governorate,
                    latitude: SECOND_WAREHOUSE.latitude, longitude: SECOND_WAREHOUSE.longitude, locationSource: "IMPORTED",
                },
                select: { id: true },
            })
            warehouses++

            // Move part of the stock of the first products that have enough, as linked OUT / IN rows
            const movable = await prisma.stockLevel.findMany({
                where: { warehouseId: main.id, quantity: { gte: 10 }, product: { shopId: shop.id, deletedAt: null } },
                orderBy: { productId: "asc" },
                take: TRANSFERRED_PRODUCTS,
                select: { productId: true, quantity: true },
            })
            for (const m of movable) {
                const moved = Math.max(1, Math.floor(m.quantity * TRANSFER_SHARE))
                const transferId = `seed-transfer-${m.productId}`
                await prisma.stockLevel.update({
                    where: { productId_warehouseId: { productId: m.productId, warehouseId: main.id } },
                    data: { quantity: m.quantity - moved },
                })
                await prisma.stockLevel.create({ data: { productId: m.productId, warehouseId: second.id, quantity: moved } })
                await prisma.stockMovement.createMany({
                    data: [
                        { shopId: shop.id, warehouseId: main.id, productId: m.productId, type: "TRANSFER_OUT" as const, quantity: -moved, balanceAfter: m.quantity - moved, reason: "Demo transfer", transferId },
                        { shopId: shop.id, warehouseId: second.id, productId: m.productId, type: "TRANSFER_IN" as const, quantity: moved, balanceAfter: moved, reason: "Demo transfer", transferId },
                    ],
                })
                transfers++
            }
            log(`${shop.name}: second warehouse "${SECOND_WAREHOUSE.name}", ${transfers} products spread over both`)
        }
        return `${warehouses} warehouses created, ${levels} stock levels, ${transfers} transfers`
    },
}
