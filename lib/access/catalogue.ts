// lib/access/catalogue.ts
// The single source of truth for permission keys: "module.resource.action".
// Roles store these as plain strings, so adding a key here never needs a migration.
// Pure and dependency-free (unit tested without a database).
//
// Scopes
//   BUSINESS  what people can do for a whole business: its own keys (business.*) plus every SHOP key,
//             which then apply in each shop of the business (see evaluate.ts)
//   SHOP      what people working inside a shop can do (evaluated for one shop at a time)
//   PLATFORM  what Bayna staff can do across the marketplace
//   CLIENT    self-service abilities. Enforced by ownership ("my own orders"), no role needed.
//             Listed so every ability in the product has a name.
// The same key can exist in SHOP and PLATFORM (for example order.request.view_all). The scope of
// the check decides which one is meant: a check that names a shop uses shop assignments,
// a check without one uses platform assignments.

export const SHOP_PERMISSIONS = {
    "shop.profile": ["view", "edit", "edit_legal"],
    "shop.hours": ["edit"],
    "shop.media": ["manage"],
    "shop.fulfilment": ["edit"],
    "shop.delivery_zone": ["manage"],
    "shop.status": ["close_temporarily", "reopen"],
    "shop.closure": ["request"],
    "product.listing": ["view", "create", "edit", "archive", "restore", "delete", "publish"],
    "product.price": ["edit", "view_history"],
    "product.stock": ["edit", "view_history"],
    "product.image": ["manage"],
    "product.bulk": ["edit", "import", "export"],
    "product.suggestion": ["create"],
    "pricing.tier": ["manage"],
    "pricing.promotion": ["manage"],
    "pricing.tax": ["manage"],
    "pricing.delivery_fee": ["manage"],
    "inventory.location": ["manage"],
    "inventory.adjustment": ["create"],
    "order.request": ["view_assigned", "view_all", "accept", "reject", "update_status", "cancel", "assign", "refund", "export"],
    "order.note": ["create"],
    "order.message": ["send"],
    "customer.contact": ["view", "message"],
    "team.member": ["view", "invite", "update_role", "suspend", "remove", "transfer_ownership"],
    "team.role": ["view", "manage"],
    "activity.log": ["view", "export"],
    "insight.dashboard": ["view"],
    "insight.report": ["export"],
    "billing.subscription": ["view", "manage"],
    "billing.invoice": ["view"],
    "support.ticket": ["create", "view_shop", "comment"],
    "feedback.request": ["create", "vote", "comment"],
    "notification.settings": ["manage"],
    "integration.api_key": ["manage"],
    "integration.webhook": ["manage"],
    "review.rating": ["view", "reply"],
} as const

// Keys that only exist at business level. A business-level role may also hold any SHOP key; those
// keys then work in every shop of the business.
export const BUSINESS_PERMISSIONS = {
    "business.profile": ["view", "edit", "edit_legal"],
    "business.shop": ["create", "change_status"],
    "business.team": ["view", "invite", "update_role", "suspend", "remove", "transfer_ownership"],
    "business.role": ["view", "manage"],
} as const

export const PLATFORM_PERMISSIONS = {
    "user.account": ["view", "create", "update", "suspend", "reinstate", "delete", "restore", "export"],
    "user.credential": ["reset_password", "revoke_sessions", "force_logout"],
    "shop.application": ["view", "approve", "reject", "request_changes"],
    "shop.record": ["view", "update", "verify", "suspend", "reinstate", "delete", "restore"],
    "catalog.item": ["view", "create", "update", "archive", "merge", "import", "export"],
    "catalog.category": ["view", "create", "update", "archive", "reorder"],
    "catalog.suggestion": ["view", "review"],
    "product.listing": ["view_all", "hide", "delete"],
    "product.moderation": ["manage"],
    "order.request": ["view_all", "intervene", "cancel", "refund"],
    "order.dispute": ["view", "manage", "resolve"],
    "support.ticket": [
        "view_all", "assign", "reply", "note_internal", "change_status", "change_priority",
        "merge", "delete", "escalate", "export", "reopen",
    ],
    "support.canned_reply": ["manage"],
    "support.sla": ["manage"],
    "feedback.request": ["view_all", "triage", "merge", "change_status", "comment", "publish_roadmap", "delete"],
    "content.page": ["manage"],
    "settings.platform": ["view", "update"],
    "settings.feature_flag": ["manage"],
    "access.role": ["view", "create", "update", "delete"],
    "access.assignment": ["view", "grant", "revoke"],
    "audit.log": ["view", "export"],
    "audit.impersonation": ["view"],
    "impersonation.session": ["start_readonly", "start_write", "end_any", "view"],
    "finance.commission": ["view", "manage"],
    "finance.payout": ["view", "manage"],
    "analytics.dashboard": ["view"],
    "analytics.report": ["export"],
    "notification.broadcast": ["send"],
    "privacy.request": ["view", "fulfil_export", "fulfil_erasure"],
    "system.health": ["view"],
    "system.job": ["view", "run"],
} as const

export const CLIENT_PERMISSIONS = {
    "account.profile": ["view", "update"],
    "account.password": ["change"],
    "account.session": ["view", "revoke"],
    "account.activity": ["view"],
    "account.data": ["export", "request_erasure"],
    "shop.application": ["submit", "edit_pending", "withdraw"],
    "estimate.cart": ["manage"],
    "order.request": ["create", "view_own", "cancel_own"],
    "review.rating": ["create"],
    "support.ticket": ["create", "view_own", "comment", "close_own"],
    "feedback.request": ["create", "vote", "comment"],
    "notification.settings": ["manage_own"],
} as const

type KeysOf<T extends Record<string, readonly string[]>> = {
    [K in keyof T & string]: `${K}.${T[K][number]}`
}[keyof T & string]

export type ShopPermission = KeysOf<typeof SHOP_PERMISSIONS>
export type BusinessPermission = KeysOf<typeof BUSINESS_PERMISSIONS>
export type PlatformPermission = KeysOf<typeof PLATFORM_PERMISSIONS>
export type ClientPermission = KeysOf<typeof CLIENT_PERMISSIONS>
export type Permission = ShopPermission | PlatformPermission | ClientPermission

function flatten(table: Record<string, readonly string[]>): string[] {
    return Object.entries(table).flatMap(([resource, actions]) => actions.map((a) => `${resource}.${a}`))
}

export const ALL_SHOP_KEYS = flatten(SHOP_PERMISSIONS) as ShopPermission[]
export const ALL_BUSINESS_ONLY_KEYS = flatten(BUSINESS_PERMISSIONS) as BusinessPermission[]
/** What a business-level role may hold: the business keys and every shop key. */
export const ALL_BUSINESS_KEYS: string[] = [...ALL_BUSINESS_ONLY_KEYS, ...ALL_SHOP_KEYS]
export const ALL_PLATFORM_KEYS = flatten(PLATFORM_PERMISSIONS) as PlatformPermission[]
export const ALL_CLIENT_KEYS = flatten(CLIENT_PERMISSIONS) as ClientPermission[]

/**
 * The key that makes someone an owner of a level. There is no special "Owner" role: the rule "there
 * is always an owner" means "someone always holds this key" (a role with "*" holds it too).
 * See owners.ts.
 */
export const OWNERSHIP_KEY = {
    BUSINESS: "business.team.transfer_ownership",
    SHOP: "team.member.transfer_ownership",
    /** The platform owner is whoever can give staff roles (a Super admin; the Admin template cannot) */
    PLATFORM: "access.assignment.grant",
} as const

/** Does this list of keys hold `key`? ("*" holds everything.) */
export function holdsKey(permissions: readonly string[], key: string): boolean {
    return permissions.includes("*") || permissions.includes(key)
}

/**
 * Keys a role of this scope may hold. "*" ("everything, now and later") is an ordinary choice for any
 * role: it is bounded by the rule that nobody hands out what they do not hold themselves.
 */
export function isKnownKey(scope: "PLATFORM" | "BUSINESS" | "SHOP", key: string): boolean {
    if (key === "*") return true
    const keys: readonly string[] = scope === "PLATFORM" ? ALL_PLATFORM_KEYS : scope === "BUSINESS" ? ALL_BUSINESS_KEYS : ALL_SHOP_KEYS
    return keys.includes(key)
}
