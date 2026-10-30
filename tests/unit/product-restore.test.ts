// lib/product-restore.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { Unit } from "@/app/generated/prisma/enums"
import { planRestore } from "@/lib/products/product-restore"

const catalog = (over: Partial<{ isActive: boolean; unit: Unit; categoryId: string }> = {}) => ({
    isActive: true,
    unit: Unit.PIECE,
    categoryId: "c1",
    ...over,
})

test("a custom product comes back unchanged", () => {
    assert.deepEqual(planRestore({ catalogItemId: null, unit: Unit.PIECE }, null), { ok: true, changes: {} })
})

test("a linked product with the same unit only takes the catalogue category", () => {
    assert.deepEqual(planRestore({ catalogItemId: "i1", unit: Unit.PIECE }, catalog()), {
        ok: true,
        changes: { categoryId: "c1" },
    })
})

test("a changed unit brings the unit in line and asks for a price check", () => {
    const plan = planRestore({ catalogItemId: "i1", unit: Unit.PIECE }, catalog({ unit: Unit.BAG }))
    assert.equal(plan.ok, true)
    if (plan.ok) {
        assert.equal(plan.changes.unit, Unit.BAG)
        assert.equal(plan.changes.needsPriceReview, true)
        assert.equal(plan.changes.priceReviewReason, "Unit changed from Piece to Bag")
    }
})

test("an archived or missing catalogue item cannot be restored", () => {
    assert.equal(planRestore({ catalogItemId: "i1", unit: Unit.PIECE }, catalog({ isActive: false })).ok, false)
    assert.equal(planRestore({ catalogItemId: "i1", unit: Unit.PIECE }, null).ok, false)
})
