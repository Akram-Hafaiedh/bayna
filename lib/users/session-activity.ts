// lib/users/session-activity.ts
// "Last active" only has to be roughly right, so it is written at most once per interval instead of on every
// request (the JWT callback runs on every auth() call).
export const ACTIVITY_TOUCH_MS = 5 * 60 * 1000

export function shouldTouchActivity(lastActiveAt: Date | null | undefined, now: number, everyMs = ACTIVITY_TOUCH_MS): boolean {
    if (!lastActiveAt) return true
    return now - lastActiveAt.getTime() >= everyMs
}
