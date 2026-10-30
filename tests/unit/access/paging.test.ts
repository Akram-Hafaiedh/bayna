import { describe, expect, it } from "vitest"
import { PAGE_SIZE, nextCount, takePage } from "@/lib/access/paging"

const rows = (n: number) => Array.from({ length: n }, (_, i) => i)

describe("takePage", () => {
    it("shows everything when the list is short", () => {
        expect(takePage(rows(4), 1)).toHaveLength(4)
    })
    it("shows one page at a time and grows by a page", () => {
        expect(takePage(rows(25), 1)).toHaveLength(PAGE_SIZE)
        expect(takePage(rows(25), 2)).toHaveLength(PAGE_SIZE * 2)
        expect(takePage(rows(25), 3)).toHaveLength(25)
    })
    it("never shows less than one page", () => {
        expect(takePage(rows(25), 0)).toHaveLength(PAGE_SIZE)
    })
})

describe("nextCount", () => {
    it("is 0 when nothing is hidden", () => {
        expect(nextCount(10, 1)).toBe(0)
        expect(nextCount(3, 1)).toBe(0)
    })
    it("is a full page, or what is left", () => {
        expect(nextCount(35, 1)).toBe(10)
        expect(nextCount(25, 2)).toBe(5)
    })
})
