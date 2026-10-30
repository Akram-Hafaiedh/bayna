// lib/shops/shop-status.ts
// The life of a shop. Pure (unit tested); the routes and pages ask this file what is allowed.
//
//   DRAFT      started, not sent for approval yet
//   PENDING    sent, waiting for the platform team
//   ACTIVE     approved and live: the only status in which the shop can be opened and sells
//   SUSPENDED  stopped by the platform team (owners cannot undo it)
//   CLOSED     closed by its owners; can be reopened
//
// Removing a shop for good is still `deletedAt`, not a status.

export const SHOP_STATUSES = ["DRAFT", "PENDING", "ACTIVE", "SUSPENDED", "CLOSED"] as const
export type ShopStatusValue = (typeof SHOP_STATUSES)[number]

export const SHOP_STATUS_LABEL: Record<ShopStatusValue, string> = {
    DRAFT: "Draft",
    PENDING: "Waiting for approval",
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    CLOSED: "Closed",
}

export type StatusTone = "green" | "amber" | "red" | "zinc"

export const SHOP_STATUS_TONE: Record<ShopStatusValue, StatusTone> = {
    DRAFT: "zinc",
    PENDING: "amber",
    ACTIVE: "green",
    SUSPENDED: "red",
    CLOSED: "zinc",
}

// Statuses of a shop that has not been approved yet (the applicant can still edit it as an application).
export const WAITING_STATUSES = ["DRAFT", "PENDING"] as const satisfies readonly ShopStatusValue[]

export const isShopStatus = (v: unknown): v is ShopStatusValue =>
    typeof v === "string" && (SHOP_STATUSES as readonly string[]).includes(v)

export const isLive = (status: ShopStatusValue) => status === "ACTIVE"
export const isWaiting = (status: ShopStatusValue) => status === "DRAFT" || status === "PENDING"

export type StatusActor = "owner" | "platform"

export type ShopAction = "submit" | "close" | "reopen" | "approve" | "suspend" | "reinstate"

type Move = { action: ShopAction; from: ShopStatusValue; to: ShopStatusValue; actor: StatusActor; label: string }

export const SHOP_MOVES: readonly Move[] = [
    { action: "submit", from: "DRAFT", to: "PENDING", actor: "owner", label: "Send for approval" },
    { action: "approve", from: "PENDING", to: "ACTIVE", actor: "platform", label: "Approve" },
    { action: "close", from: "ACTIVE", to: "CLOSED", actor: "owner", label: "Close shop" },
    { action: "reopen", from: "CLOSED", to: "ACTIVE", actor: "owner", label: "Reopen shop" },
    { action: "suspend", from: "ACTIVE", to: "SUSPENDED", actor: "platform", label: "Suspend" },
    { action: "reinstate", from: "SUSPENDED", to: "ACTIVE", actor: "platform", label: "Reinstate" },
]

// The move `action` makes from `from`, or null when that action is not allowed from that status.
export function moveFor(action: ShopAction, from: ShopStatusValue): Move | null {
    return SHOP_MOVES.find((m) => m.action === action && m.from === from) ?? null
}

// What `actor` can do to a shop in this status.
export function actionsFor(status: ShopStatusValue, actor: StatusActor): Move[] {
    return SHOP_MOVES.filter((m) => m.from === status && m.actor === actor)
}
