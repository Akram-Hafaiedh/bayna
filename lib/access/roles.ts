// lib/access/roles.ts
// System roles, written as patterns for readability and expanded into explicit permission keys.
// `npm run access:sync` stores the expanded lists in the database. Pure, no database access.
//
// Changing a role here does nothing until the sync runs, and a permission added to the catalogue
// later reaches an existing role only when someone edits that role below and re-syncs.

import {
    ALL_PLATFORM_KEYS,
    ALL_SHOP_KEYS,
    isKnownKey,
} from "./catalogue"
import { expandPatterns } from "./match"

export type SystemRole = {
    key: string
    name: string
    description: string
    scope: "PLATFORM" | "SHOP"
    /** Explicit keys, or ["*"] for SUPER_ADMIN only */
    permissions: string[]
}

type Def = {
    key: string
    name: string
    description: string
    scope: "PLATFORM" | "SHOP"
    include: string[]
    exclude?: string[]
}

const DEFS: Def[] = [
    // ---- Platform ----------------------------------------------------------------------------
    {
        key: "SUPER_ADMIN",
        name: "Super admin",
        description: "Everything. Protected: only another super admin can assign it, and the last one cannot be removed.",
        scope: "PLATFORM",
        include: ["*"],
    },
    {
        key: "ADMIN",
        name: "Admin",
        description: "Runs the marketplace. Cannot manage roles or access, write while impersonating, or run system jobs.",
        scope: "PLATFORM",
        include: ["*"],
        exclude: ["access.*", "impersonation.session.start_write", "system.job.run"],
    },
    {
        key: "SUPPORT_AGENT",
        name: "Support agent",
        description: "Handles tickets and feedback, can look at users, shops and orders, and view as a user read-only.",
        scope: "PLATFORM",
        include: [
            "support.ticket.view_all", "support.ticket.reply", "support.ticket.note_internal",
            "support.ticket.change_status", "support.ticket.change_priority", "support.ticket.reopen",
            "feedback.request.view_all", "feedback.request.triage", "feedback.request.change_status",
            "feedback.request.comment",
            "user.account.view", "shop.provider.view", "shop.application.view",
            "order.request.view_all", "order.dispute.view",
            "impersonation.session.start_readonly", "impersonation.session.view",
        ],
    },
    {
        key: "SUPPORT_LEAD",
        name: "Support lead",
        description: "Support agent plus assigning, merging, escalating, exporting, canned replies and SLAs.",
        scope: "PLATFORM",
        include: [
            "support.ticket.view_all", "support.ticket.reply", "support.ticket.note_internal",
            "support.ticket.change_status", "support.ticket.change_priority", "support.ticket.reopen",
            "support.ticket.assign", "support.ticket.merge", "support.ticket.escalate", "support.ticket.export",
            "support.canned_reply.manage", "support.sla.manage",
            "feedback.request.view_all", "feedback.request.triage", "feedback.request.change_status",
            "feedback.request.comment", "feedback.request.merge",
            "user.account.view", "shop.provider.view", "shop.application.view",
            "order.request.view_all", "order.dispute.view",
            "impersonation.session.start_readonly", "impersonation.session.view",
        ],
    },
    {
        key: "CATALOGUE_MANAGER",
        name: "Catalogue manager",
        description: "Owns the shared catalogue, categories and suggestions.",
        scope: "PLATFORM",
        include: ["catalog.*", "product.listing.view_all"],
    },
    {
        key: "MODERATOR",
        name: "Moderator",
        description: "Reviews shop applications, shops, listings and disputes.",
        scope: "PLATFORM",
        include: ["shop.application.*", "shop.provider.*", "product.moderation.*", "order.dispute.*"],
    },
    {
        key: "FINANCE",
        name: "Finance",
        description: "Commissions, payouts, order totals and analytics.",
        scope: "PLATFORM",
        include: ["finance.*", "order.request.view_all", "analytics.*"],
    },
    {
        key: "AUDITOR",
        name: "Auditor",
        description: "Read-only: audit logs, access setup, users and shops.",
        scope: "PLATFORM",
        include: [
            "audit.*", "access.*.view",
            "user.account.view", "shop.provider.view", "shop.application.view",
        ],
    },

    // ---- Shop --------------------------------------------------------------------------------
    {
        key: "OWNER",
        name: "Owner",
        description: "Everything for the shop. Protected: the last owner cannot be removed.",
        scope: "SHOP",
        include: ["*"],
    },
    {
        key: "MANAGER",
        name: "Manager",
        description: "Everything except ownership transfer, billing changes, legal details and integrations.",
        scope: "SHOP",
        include: ["*"],
        exclude: [
            "team.member.transfer_ownership", "billing.subscription.manage",
            "shop.profile.edit_legal", "integration.*",
        ],
    },
    {
        key: "ORDER_HANDLER",
        name: "Order handler",
        description: "Works the order requests and talks to customers. Can see products but not change them.",
        scope: "SHOP",
        include: [
            "order.request.view_assigned", "order.request.view_all", "order.request.accept",
            "order.request.reject", "order.request.update_status", "order.request.cancel",
            "order.note.create", "order.message.send",
            "customer.contact.view", "product.listing.view",
        ],
    },
    {
        key: "INVENTORY_CLERK",
        name: "Inventory clerk",
        description: "Creates and edits listings, stock and images. Cannot change prices.",
        scope: "SHOP",
        include: [
            "product.listing.view", "product.listing.create", "product.listing.edit",
            "product.stock.*", "product.image.*", "product.bulk.import", "product.suggestion.create",
            "inventory.*",
        ],
    },
    {
        key: "ACCOUNTANT",
        name: "Accountant",
        description: "Order totals, billing, tax settings, insights and reports.",
        scope: "SHOP",
        include: [
            "order.request.view_all", "order.request.export",
            "billing.subscription.view", "billing.invoice.view",
            "insight.*", "pricing.tax.manage", "product.listing.view",
        ],
    },
    {
        key: "VIEWER",
        name: "Viewer",
        description: "Read-only access to the shop.",
        scope: "SHOP",
        include: [
            "shop.profile.view", "product.listing.view", "order.request.view_all",
            "insight.dashboard.view", "team.member.view", "review.rating.view",
        ],
    },
]

function build(def: Def): SystemRole {
    const base = { key: def.key, name: def.name, description: def.description, scope: def.scope }
    // Only SUPER_ADMIN stores the wildcard; every other role gets explicit keys.
    if (def.key === "SUPER_ADMIN") return { ...base, permissions: ["*"] }
    const all = def.scope === "PLATFORM" ? ALL_PLATFORM_KEYS : ALL_SHOP_KEYS
    return { ...base, permissions: expandPatterns(all, def.include, def.exclude ?? []) }
}

export const SYSTEM_ROLES: SystemRole[] = DEFS.map(build)

export const SUPER_ADMIN_KEY = "SUPER_ADMIN"
export const OWNER_KEY = "OWNER"

/** Problems with the role definitions: unknown keys, patterns that match nothing. Empty = fine. */
export function validateSystemRoles(roles: SystemRole[] = SYSTEM_ROLES): string[] {
    const problems: string[] = []
    const seen = new Set<string>()
    for (const r of roles) {
        const id = `${r.scope}:${r.key}`
        if (seen.has(id)) problems.push(`duplicate role ${id}`)
        seen.add(id)
        if (r.permissions.length === 0) problems.push(`${id} has no permissions`)
        for (const k of r.permissions) {
            if (!isKnownKey(r.scope, k)) problems.push(`${id} holds unknown key "${k}"`)
            if (k === "*" && r.key !== SUPER_ADMIN_KEY) problems.push(`${id} holds "*" (only SUPER_ADMIN may)`)
        }
    }
    for (const def of DEFS) {
        const all = def.scope === "PLATFORM" ? ALL_PLATFORM_KEYS : ALL_SHOP_KEYS
        for (const p of def.include) {
            if (def.key === SUPER_ADMIN_KEY) continue
            if (expandPatterns(all, [p]).length === 0) problems.push(`${def.key}: "${p}" matches no key`)
        }
        for (const p of def.exclude ?? []) {
            if (expandPatterns(all, [p]).length === 0) problems.push(`${def.key}: exclude "${p}" matches no key`)
        }
    }
    return problems
}
