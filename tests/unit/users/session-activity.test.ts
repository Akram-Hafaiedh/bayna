import { expect, test } from "vitest"
import { ACTIVITY_TOUCH_MS, shouldTouchActivity } from "@/lib/users/session-activity"

const now = Date.UTC(2026, 9, 26, 12, 0, 0)

test("a session never touched is written", () => {
    expect(shouldTouchActivity(null, now)).toBe(true)
    expect(shouldTouchActivity(undefined, now)).toBe(true)
})

test("a recent touch is skipped, an old one is written", () => {
    expect(shouldTouchActivity(new Date(now - 1000), now)).toBe(false)
    expect(shouldTouchActivity(new Date(now - ACTIVITY_TOUCH_MS + 1), now)).toBe(false)
    expect(shouldTouchActivity(new Date(now - ACTIVITY_TOUCH_MS), now)).toBe(true)
})
