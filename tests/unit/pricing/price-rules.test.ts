// tests/unit/pricing/price-rules.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    computePrice, fromMillimes, parseTaxChoice, parseTaxFields, taxState, toMillimes, type TaxInput,
} from "@/lib/pricing/price-rules"

const tax = (id: string, kind: "PERCENTAGE" | "FIXED", value: string, appliesOn: "BASE" | "RUNNING" = "BASE"): TaxInput => ({ id, name: `Tax ${id}`, kind, value, appliesOn })
const value = <T,>(r: { ok: true; value: T } | { ok: false; error: string }) => {
    if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
    return r.value
}
const error = (r: { ok: boolean; error?: string }) => {
    assert.equal(r.ok, false)
    return (r as { error: string }).error
}

test("millimes: exact, three decimals at most", () => {
    assert.equal(toMillimes("12"), BigInt(12000))
    assert.equal(toMillimes("12.5"), BigInt(12500))
    assert.equal(toMillimes("12.345"), BigInt(12345))
    assert.equal(toMillimes(0.5), BigInt(500))
    assert.equal(toMillimes("0"), BigInt(0))
    for (const bad of ["", " ", "-1", "12.3456", "1e3", "abc", "1,5", "1234567890", NaN, Infinity, 0.1 + 0.2]) {
        assert.equal(toMillimes(bad as string | number), null, String(bad))
    }
    assert.equal(fromMillimes(BigInt(120690)), "120.690")
    assert.equal(fromMillimes(BigInt(5)), "0.005")
    assert.equal(fromMillimes(BigInt(0)), "0.000")
    assert.equal(fromMillimes(BigInt(12000)), "12.000")
})

test("the worked example of the design: 1% on the base, 19% on the running total, 0.500 fixed", () => {
    const r = computePrice("100.000", [tax("a", "PERCENTAGE", "1", "BASE"), tax("b", "PERCENTAGE", "19", "RUNNING"), tax("c", "FIXED", "0.500")])
    assert.deepEqual(r.lines.map((l) => l.amount), ["1.000", "19.190", "0.500"])
    assert.equal(r.taxTotal, "20.690")
    assert.equal(r.total, "120.690")
    assert.equal(r.base, "100.000")
})

test("no taxes: the price with tax is the price", () => {
    assert.deepEqual(computePrice("12.500", []), { base: "12.500", lines: [], taxTotal: "0.000", total: "12.500" })
    assert.equal(computePrice(0, []).total, "0.000")
})

test("the order matters for a tax on the running total", () => {
    const base = tax("base", "PERCENTAGE", "10", "BASE")
    const running = tax("run", "PERCENTAGE", "10", "RUNNING")
    // base first: 10 on 100, then 10% of 110
    assert.equal(computePrice("100", [base, running]).total, "121.000")
    // running first: it has nothing before it, so it is 10% of 100; then 10 on the base
    assert.equal(computePrice("100", [running, base]).total, "120.000")
    // a fixed amount before a running percentage is part of what the percentage applies on
    assert.equal(computePrice("100", [tax("f", "FIXED", "10"), running]).total, "121.000")
})

test("each line is rounded half up to the millime, and the lines add up to the total", () => {
    // 5 millimes at 50% is 2.5 millimes: half up gives 3
    assert.equal(computePrice("0.005", [tax("h", "PERCENTAGE", "50")]).lines[0].amount, "0.003")
    // 10.003 at 19% is 1.90057: 1.901
    assert.equal(computePrice("10.003", [tax("v", "PERCENTAGE", "19")]).lines[0].amount, "1.901")
    // 0.001 at 49.9% is 0.4999 millimes: rounds down to 0
    assert.equal(computePrice("0.001", [tax("l", "PERCENTAGE", "49.9")]).lines[0].amount, "0.000")
    // a percentage with decimals
    assert.equal(computePrice("100", [tax("d", "PERCENTAGE", "7.25")]).lines[0].amount, "7.250")
    // the total is exactly base + the rounded lines, for a spread of prices
    for (let m = 1; m < 3000; m += 37) {
        const price = fromMillimes(BigInt(m))
        const r = computePrice(price, [tax("a", "PERCENTAGE", "1", "BASE"), tax("b", "PERCENTAGE", "19", "RUNNING"), tax("c", "FIXED", "0.5")])
        const sum = r.lines.reduce((s, l) => s + toMillimes(l.amount)!, BigInt(0))
        assert.equal(toMillimes(r.total), toMillimes(price)! + sum, price)
        assert.equal(toMillimes(r.taxTotal), sum, price)
    }
})

test("large prices do not lose precision", () => {
    const r = computePrice("999999999.999", [tax("v", "PERCENTAGE", "19")])
    assert.equal(r.lines[0].amount, "190000000.000") // 999999999.999 * 0.19 = 189999999.99981 -> rounds to .000 of the next
    assert.equal(r.total, "1189999999.999")
})

test("a bad price or a bad tax value is refused, never silently priced", () => {
    assert.throws(() => computePrice("abc", []))
    assert.throws(() => computePrice("1", [tax("x", "PERCENTAGE", "nineteen")]))
    assert.throws(() => computePrice("1", [tax("x", "FIXED", "0.0005")]))
})

test("taxState: taxed, exempt, or to set", () => {
    assert.equal(taxState({ taxExempt: false, activeTaxCount: 2 }), "TAXED")
    assert.equal(taxState({ taxExempt: false, activeTaxCount: 0 }), "UNSET")
    assert.equal(taxState({ taxExempt: true, activeTaxCount: 0 }), "EXEMPT")
    assert.equal(taxState({ taxExempt: true, activeTaxCount: 1 }), "EXEMPT")
})

test("parseTaxChoice: taxes and exempt are optional and exclude each other", () => {
    assert.deepEqual(value(parseTaxChoice({})), {})
    assert.deepEqual(value(parseTaxChoice({ taxIds: ["a", "b", "a"] })), { taxIds: ["a", "b"] })
    assert.deepEqual(value(parseTaxChoice({ taxExempt: true })), { taxExempt: true })
    assert.deepEqual(value(parseTaxChoice({ taxIds: [], taxExempt: true })), { taxIds: [], taxExempt: true })
    assert.match(error(parseTaxChoice({ taxIds: ["a"], taxExempt: true })), /exempt/)
    assert.match(error(parseTaxChoice({ taxIds: "a" })), /list/)
    assert.match(error(parseTaxChoice({ taxIds: [1] })), /list/)
    assert.match(error(parseTaxChoice({ taxIds: [""] })), /list/)
    assert.match(error(parseTaxChoice({ taxExempt: "yes" })), /true or false/)
    assert.match(error(parseTaxChoice({ taxIds: Array.from({ length: 21 }, (_, i) => `t${i}`) })), /20/)
    assert.deepEqual(value(parseTaxChoice(null)), {})
})

test("parseTaxFields: creating needs a name, a kind and a value", () => {
    assert.match(error(parseTaxFields({ kind: "PERCENTAGE", value: 19 }, null)), /name is required/i)
    assert.match(error(parseTaxFields({ name: "V", kind: "PERCENTAGE", value: 19 }, null)), /too short/)
    assert.match(error(parseTaxFields({ name: "x".repeat(61), kind: "PERCENTAGE", value: 19 }, null)), /too long/)
    assert.match(error(parseTaxFields({ name: "VAT", value: 19 }, null)), /percentage or a fixed/)
    assert.match(error(parseTaxFields({ name: "VAT", kind: "PERCENTAGE" }, null)), /value/)
    assert.match(error(parseTaxFields("nope", null)), /Invalid request/)
    const d = value(parseTaxFields({ name: "  VAT  ", kind: "PERCENTAGE", value: 19, appliesOn: "RUNNING" }, null))
    assert.deepEqual(d, { name: "VAT", kind: "PERCENTAGE", value: "19", appliesOn: "RUNNING" })
})

test("parseTaxFields: percentages are above 0 and at most 100, fixed amounts have at most 3 decimals", () => {
    const pct = (v: unknown) => parseTaxFields({ name: "VAT", kind: "PERCENTAGE", value: v }, null)
    for (const ok of [1, "19", "0.0001", "100", "7.25"]) assert.equal(pct(ok).ok, true, String(ok))
    for (const bad of [0, "0", -5, "100.0001", 101, "abc", "", "1.00001", null]) assert.equal(pct(bad).ok, false, String(bad))
    const fixed = (v: unknown) => parseTaxFields({ name: "Stamp", kind: "FIXED", value: v }, null)
    for (const ok of [0.5, "0.500", "12", "0.001"]) assert.equal(fixed(ok).ok, true, String(ok))
    for (const bad of [0, "0", "0.0005", -1, "abc", "1000000000"]) assert.equal(fixed(bad).ok, false, String(bad))
})

test("parseTaxFields: a fixed amount is always stored as applying on the base", () => {
    assert.equal(value(parseTaxFields({ name: "Stamp", kind: "FIXED", value: "0.5", appliesOn: "RUNNING" }, null)).appliesOn, "BASE")
    assert.match(error(parseTaxFields({ name: "VAT", kind: "PERCENTAGE", value: 19, appliesOn: "SOMETIMES" }, null)), /applies/)
})

test("parseTaxFields: editing changes only what is sent, and a new kind re-checks the value", () => {
    const current = { kind: "PERCENTAGE" as const, value: "19" }
    assert.deepEqual(value(parseTaxFields({}, current)), {})
    assert.deepEqual(value(parseTaxFields({ isActive: false }, current)), { isActive: false })
    assert.deepEqual(value(parseTaxFields({ name: "TVA" }, current)), { name: "TVA" })
    assert.equal(value(parseTaxFields({ value: "7" }, current)).value, "7")
    assert.match(error(parseTaxFields({ value: "150" }, current)), /at most 100/)
    // changing to fixed keeps the old value only if it fits: 19 TND is fine, but 0.0005 is not
    assert.equal(value(parseTaxFields({ kind: "FIXED" }, current)).value, "19")
    assert.match(error(parseTaxFields({ kind: "FIXED" }, { kind: "PERCENTAGE", value: "0.0005" })), /3 decimals/)
    assert.match(error(parseTaxFields({ isActive: "yes" }, current)), /true or false/)
    assert.match(error(parseTaxFields({ name: "" }, current)), /too short/)
})
