// lib/notifications.ts
// Create notifications. Call notify() with the transaction client from withAudit, so the
// notification is saved with the event it reports and never exists for a change that was rolled back.
//
//   await withAudit(guard.actor, async (tx) => {
//       await tx.shop.update({ where: { id }, data: { needsReview: false } })
//       await notify(tx, shop.applicantId, notifications.profileReviewed({ shop: shop.publicShopId }))
//   })
import type { Tx } from "@/lib/audit/run"
import { shopPath } from "@/lib/shop-paths"

export const NOTIFICATION_TYPES = {
    applicationApproved: "shop.application.approved",
    applicationRejected: "shop.application.rejected",
    profileReviewed: "shop.profile.reviewed",
    priceReviewNeeded: "catalog.unit.changed",
    teamJoined: "team.member.joined",
    teamRoleChanged: "team.member.role_changed",
    teamSuspended: "team.member.suspended",
    teamReinstated: "team.member.reinstated",
    teamRemoved: "team.member.removed",
    accountDeletionCancelled: "account.deletion.cancelled",
    supportViewedAccount: "account.support.viewed",
} as const

export type NotificationInput = {
    type: string
    title: string
    body?: string | null
    /** A path inside the app, for example "/shop/<publicShopId>/profile" */
    href?: string | null
}

export const TITLE_MAX = 120
export const BODY_MAX = 400

/** Public ids (the ones in shop URLs) of some shops, by shop id: the messages below link to a shop's pages with them. */
export async function shopPublicIds(tx: Tx, shopIds: string[]): Promise<Map<string, string>> {
    if (shopIds.length === 0) return new Map()
    const rows = await tx.shop.findMany({ where: { id: { in: shopIds } }, select: { id: true, publicShopId: true } })
    return new Map(rows.map((r) => [r.id, r.publicShopId]))
}

// `shop` below is the shop's public id. Where a message can also be about a business (a business-level
// team change) it is left out and the link goes to a page that does not need a shop.

/** Ready-made messages, so wording lives in one place. */
export const notifications = {
    supportViewedAccount: (): NotificationInput => ({
        type: NOTIFICATION_TYPES.supportViewedAccount,
        title: "Bayna support looked at your account",
        body: "A member of our team viewed your account to help you. They could only look; nothing was changed.",
        href: "/profile",
    }),
    accountDeletionCancelled: (): NotificationInput => ({
        type: NOTIFICATION_TYPES.accountDeletionCancelled,
        title: "Account deletion cancelled",
        body: "You signed in again, so your account will not be deleted.",
        href: "/profile",
    }),
    applicationApproved: (a: { shop: string }): NotificationInput => ({
        type: NOTIFICATION_TYPES.applicationApproved,
        title: "Your shop was approved",
        body: "You can now add products and manage your shop.",
        href: shopPath(a.shop, "dashboard"),
    }),
    applicationRejected: (): NotificationInput => ({
        type: NOTIFICATION_TYPES.applicationRejected,
        title: "Your application was not approved",
        body: "You can review your details and apply again.",
        href: "/become-shop",
    }),
    /** One per shop: `itemName` changed unit, `count` of the shop's products need a price check. */
    priceReviewNeeded: (a: { shop: string; itemName: string; reason: string; count: number }): NotificationInput => ({
        type: NOTIFICATION_TYPES.priceReviewNeeded,
        title: `Price check needed: ${a.itemName}`,
        body: `${a.reason}. Confirm the price of ${a.count} product${a.count === 1 ? "" : "s"}; until then ${a.count === 1 ? "it is" : "they are"} left out of comparison.`,
        href: `${shopPath(a.shop, "products")}?review=yes`,
    }),
    /** To the person who sent the invite: `who` accepted it and now works in `where` (a shop or business name). */
    teamJoined: (a: { who: string; where: string; role: string; shop?: string | null }): NotificationInput => ({
        type: NOTIFICATION_TYPES.teamJoined,
        title: `${a.who} joined ${a.where}`,
        body: `They now work there as ${a.role}.`,
        href: a.shop ? shopPath(a.shop, "team") : "/business/team",
    }),
    /** To the member: their role in `where` changed to `role`. */
    teamRoleChanged: (a: { where: string; role: string; shop?: string | null }): NotificationInput => ({
        type: NOTIFICATION_TYPES.teamRoleChanged,
        title: `Your role in ${a.where} changed`,
        body: `You are now: ${a.role}.`,
        href: a.shop ? shopPath(a.shop, "dashboard") : "/shop",
    }),
    teamSuspended: (a: { where: string }): NotificationInput => ({
        type: NOTIFICATION_TYPES.teamSuspended,
        title: `Your access to ${a.where} was suspended`,
        body: "You cannot work in it until an owner or manager reinstates you.",
        href: "/profile",
    }),
    teamReinstated: (a: { where: string; shop?: string | null }): NotificationInput => ({
        type: NOTIFICATION_TYPES.teamReinstated,
        title: `Your access to ${a.where} is back`,
        body: null,
        href: a.shop ? shopPath(a.shop, "dashboard") : "/shop",
    }),
    teamRemoved: (a: { where: string }): NotificationInput => ({
        type: NOTIFICATION_TYPES.teamRemoved,
        title: `You were removed from ${a.where}`,
        body: null,
        href: "/profile",
    }),
    profileReviewed: (a: { shop: string }): NotificationInput => ({
        type: NOTIFICATION_TYPES.profileReviewed,
        title: "Your profile changes were reviewed",
        body: "An admin checked your shop name and location. Nothing more to do.",
        href: shopPath(a.shop, "profile"),
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
