// lib/toast.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { MAX_TOASTS, pushToast, removeToast, toastDuration, type ToastItem } from "./toast"

const make = (id: number): ToastItem => ({ id, tone: "info", title: `t${id}`, duration: 1000 })

test("errors and toasts with a button stay longer than plain ones", () => {
    assert.ok(toastDuration("error", false) > toastDuration("success", false))
    assert.ok(toastDuration("success", true) > toastDuration("success", false))
    assert.ok(toastDuration("info", false) >= toastDuration("success", false))
})

test("new toasts go last and the oldest are dropped past the limit", () => {
    let list: ToastItem[] = []
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = pushToast(list, make(i))
    assert.equal(list.length, MAX_TOASTS)
    assert.equal(list[list.length - 1].id, MAX_TOASTS + 2)
    assert.equal(list[0].id, 3)
})

test("pushing does not change the list it was given", () => {
    const list = [make(1)]
    pushToast(list, make(2))
    assert.equal(list.length, 1)
})

test("removeToast drops only that toast", () => {
    const list = [make(1), make(2), make(3)]
    assert.deepEqual(removeToast(list, 2).map((t) => t.id), [1, 3])
    assert.equal(removeToast(list, 99).length, 3)
})
