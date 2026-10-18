// lib/notifications.ts
// Create notifications. Call notify() with the transaction client from withAudit, so the
// notification is saved with the event it reports and never exists for a change that was rolled back.
//
//   await withAudit(guard.actor, async (tx) => {
//       await tx.provider.update({ where: { id }, data: { needsReview: false } })
//       await notify(tx, provider.userId, notifications.profileReviewed())
//   })
import type { Tx } from "@/lib/audit/run"

export const NOTIFICATION_TYPES = {
    applicationApproved: "provider.application.approved",
    applicationRejected: "provider.application.rejected",
    profileReviewed: "provider.profile.reviewed",
    priceReviewNeeded: "catalog.unit.changed",
} as const

export type NotificationInput = {
    type: string
    title: string
    body?: string | null
    /** A path inside the app, for example "/provider/profile" */
    href?: string | null
}

export const TITLE_MAX = 120
export const BODY_MAX = 400

/** Ready-made messages, so wording lives in one place. */
export const notifications = {
    applicationApproved: (): NotificationInput => ({
        type: NOTIFICATION_TYPES.applicationApproved,
        title: "Your shop was approved",
        body: "You can now add products and manage your shop.",
        href: "/provider/dashboard",
    }),
    applicationRejected: (): NotificationInput => ({
        type: NOTIFICATION_TYPES.applicationRejected,
        title: "Your application was not approved",
        body: "You can review your details and apply again.",
        href: "/become-provider",
    }),
    /** One per shop: `itemName` changed unit, `count` of the shop's products need a price check. */
    priceReviewNeeded: (a: { itemName: string; reason: string; count: number }): NotificationInput => ({
        type: NOTIFICATION_TYPES.priceReviewNeeded,
        title: `Price check needed: ${a.itemName}`,
        body: `${a.reason}. Confirm the price of ${a.count} product${a.count === 1 ? "" : "s"}; until then ${a.count === 1 ? "it is" : "they are"} left out of comparison.`,
        href: "/provider/products?review=yes",
    }),
    profileReviewed: (): NotificationInput => ({
        type: NOTIFICATION_TYPES.profileReviewed,
        title: "Your profile changes were reviewed",
        body: "An admin checked your business name and location. Nothing more to do.",
        href: "/provider/profile",
    }),
}

export type NotificationRow = {
    userId: string
    type: string
    title: string
    body: string | null
    href: string | null
}

/**
 * One row per distinct recipient. Blank recipients are dropped, text is trimmed and cut to length,
 * and a link must be a path inside the app (it starts with a single "/") so a notification can
 * never send someone to another site.
 */
export function buildNotifications(recipients: string | (string | null | undefined)[], input: NotificationInput): NotificationRow[] {
    const ids = [...new Set((Array.isArray(recipients) ? recipients : [recipients]).filter((x): x is string => !!x && x.trim() !== ""))]
    const title = input.title.trim().slice(0, TITLE_MAX)
    if (!input.type.trim() || !title) throw new Error("A notification needs a type and a title")
    const href = input.href?.trim()
    const body = input.body?.trim().slice(0, BODY_MAX)
    return ids.map((userId) => ({
        userId,
        type: input.type.trim(),
        title,
        body: body || null,
        href: href && href.startsWith("/") && !href.startsWith("//") ? href : null,
    }))
}

export async function notify(tx: Tx, recipients: string | (string | null | undefined)[], input: NotificationInput) {
    const rows = buildNotifications(recipients, input)
    if (rows.length === 0) return 0
    const { count } = await tx.notification.createMany({ data: rows })
    return count
}
