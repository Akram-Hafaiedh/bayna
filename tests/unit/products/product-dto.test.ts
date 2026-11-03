// tests/unit/products/product-dto.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { productDto } from "@/lib/products/product-dto"
import { warehouseDto } from "@/lib/inventory/warehouse-dto"

test("a product shows its public id as id, and nothing that names the row or who touched it", () => {
    const out = productDto({ id: "internal1", publicProductId: "0123456789abcdef", shopId: "s1", createdById: "u1", updatedById: "u2", deletedById: null, name: "Cement" })
    assert.deepEqual(out, { id: "0123456789abcdef", name: "Cement" })
})

test("a warehouse shows its public id as id, and nothing that names the row or who touched it", () => {
    const out = warehouseDto({ id: "internal1", publicWarehouseId: "fedcba9876543210", shopId: "s1", createdById: "u1", updatedById: null, name: "Main", city: "Tunis" })
    assert.deepEqual(out, { id: "fedcba9876543210", name: "Main", city: "Tunis" })
})
