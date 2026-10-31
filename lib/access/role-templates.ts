// lib/access/role-templates.ts
// The default roles. They are only SEED DATA: when a business or a shop is created, these are copied
// into it as ordinary rows (lib/access/role-seed.ts), and from then on they are edited, cloned or
// deleted like any other role. Nothing reads this file at run time to decide access. Written as
// patterns for readability and expanded into explicit keys; "everything" is stored as "*", so a
// permission added later reaches such a role without any change. Pure, no database access.

import {
    ALL_BUSINESS_KEYS,
    ALL_PLATFORM_KEYS,
    ALL_SHOP_KEYS,
    OWNERSHIP_KEY,
    holdsKey,
    isKnownKey,
} from "./catalogue"
import { expandPatterns } from "./match"

export type RoleTemplate = {
    /** Only used to tell templates apart in this file and in tests. Never stored. */
    id: string
    name: string
    description: string
    scope: "PLATFORM" | "BUSINESS" | "SHOP"
    /** Explicit keys, or ["*"] for "everything" */
    permissions: string[]
}

type Def = {
    id: string
    name: string
    description: string
    scope: "PLATFORM" | "BUSINESS" | "SHOP"
    include: string[]
    exclude?: string[]
}

const DEFS: Def[] = [
    // ---- Platform ----------------------------------------------------------------------------
    {
        id: "SUPER_ADMIN",
        name: "Super admin",
        description: "Everything on the platform.",
        scope: "PLATFORM",
        include: ["*"],
    },
    {
        id: "ADMIN",
        name: "Admin",
        description: "Runs the marketplace. Cannot manage roles or access, write while impersonating, or run system jobs.",
        scope: "PLATFORM",
        include: ["*"],
        exclude: ["access.*", "impersonation.session.start_write", "system.job.run"],
    },
    {
        id: "SUPPORT_AGENT",
        name: "Support agent",
        description: "Handles tickets and feedback, can look at users, shops and orders, and view as a user read-only.",
        scope: "PLATFORM",
        include: [
            "support.ticket.view_all", "support.ticket.reply", "support.ticket.note_internal",
            "support.ticket.change_status", "support.ticket.change_priority", "support.ticket.reopen",
            "feedback.request.view_all", "feedback.request.triage", "feedback.request.change_status",
            "feedback.request.comment",
            "user.account.view", "shop.record.view", "shop.application.view",
            "order.request.view_all", "order.dispute.view",
            "impersonation.session.start_readonly", "impersonation.session.view",
        ],
    },
    {
        id: "SUPPORT_LEAD",
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
            "user.account.view", "shop.record.view", "shop.application.view",
            "order.request.view_all", "order.dispute.view",
            "impersonation.session.start_readonly", "impersonation.session.view",
        ],
    },
    {
        id: "CATALOGUE_MANAGER",
        name: "Catalogue manager",
        description: "Owns the shared catalogue, categories and suggestions.",
        scope: "PLATFORM",
        include: ["catalog.*", "product.listing.view_all"],
    },
    {
        id: "MODERATOR",
        name: "Moderator",
        description: "Reviews shop applications, shops, listings and disputes.",
        scope: "PLATFORM",
        include: ["shop.application.*", "shop.record.*", "product.moderation.*", "order.dispute.*"],
    },
    {
        id: "FINANCE",
        name: "Finance",
        description: "Commissions, payouts, order totals and analytics.",
        scope: "PLATFORM",
        include: ["finance.*", "order.request.view_all", "analytics.*"],
    },
    {
        id: "AUDITOR",
        name: "Auditor",
        description: "Read-only: audit logs, access setup, users and shops.",
        scope: "PLATFORM",
        include: [
            "audit.*", "access.*.view",
            "user.account.view", "shop.record.view", "shop.application.view",
        ],
    },

    // ---- Shop --------------------------------------------------------------------------------
    {
        id: "OWNER",
        name: "Shop owner",
        description: "Everything in the shop. There is always at least one person who can transfer ownership.",
        scope: "SHOP",
        include: ["*"],
    },
    {
        id: "MANAGER",
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
        id: "ORDER_HANDLER",
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
        id: "INVENTORY_CLERK",
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
        id: "ACCOUNTANT",
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
        id: "VIEWER",
        name: "Viewer",
        description: "Read-only access to the shop.",
        scope: "SHOP",
        include: [
            "shop.profile.view", "product.listing.view", "order.request.view_all",
            "insight.dashboard.view", "team.member.view", "review.rating.view", "inventory.movement.view",
        ],
    },

    {
        id: "HR",
        name: "HR",
        description: "The shop's people: invite, change roles, suspend, remove. Cannot transfer ownership.",
        scope: "SHOP",
        include: ["team.member.*", "team.role.view", "activity.log.view"],
        exclude: ["team.member.transfer_ownership"],
    },

    // ---- Business (applies in every shop of the business) --------------------------------------
    {
        id: "OWNER",
        name: "Business owner",
        description: "Everything for the business and all its shops. There is always at least one person who can transfer ownership.",
        scope: "BUSINESS",
        include: ["*"],
    },
    {
        id: "ACCOUNTANT",
        name: "Business accountant",
        description: "Order totals, billing, tax settings, insights and reports across all shops, and the business details (read-only).",
        scope: "BUSINESS",
        include: [
            "business.profile.view",
            "order.request.view_all", "order.request.export",
            "billing.subscription.view", "billing.invoice.view",
            "insight.*", "pricing.tax.manage", "product.listing.view",
        ],
    },
    {
        id: "HR",
        name: "HR",
        description: "People of the business and of every shop: invite, change roles, suspend, remove. Cannot transfer ownership.",
        scope: "BUSINESS",
        include: [
            "business.profile.view", "business.team.*", "business.role.view",
            "team.member.*", "team.role.view", "activity.log.view",
        ],
        exclude: ["business.team.transfer_ownership", "team.member.transfer_ownership"],
    },
    {
        id: "OPERATIONS",
        name: "Operations",
        description: "Runs every shop of the business. Cannot change the business itself, billing, legal details or ownership.",
        scope: "BUSINESS",
        include: ["*"],
        exclude: [
            "business.profile.edit", "business.profile.edit_legal", "business.shop.*", "business.team.*", "business.role.*",
            "team.member.transfer_ownership", "billing.subscription.manage", "shop.profile.edit_legal", "integration.*",
        ],
    },
]

function build(def: Def): RoleTemplate {
    const base = { id: def.id, name: def.name, description: def.description, scope: def.scope }
    // "Everything" is stored as "*" so it keeps covering permissions added later
    if (def.include.length === 1 && def.include[0] === "*" && !def.exclude?.length) return { ...base, permissions: ["*"] }
    return { ...base, permissions: expandPatterns(keysFor(def.scope), def.include, def.exclude ?? []) }
}

function keysFor(scope: Def["scope"]): readonly string[] {
    return scope === "PLATFORM" ? ALL_PLATFORM_KEYS : scope === "BUSINESS" ? ALL_BUSINESS_KEYS : ALL_SHOP_KEYS
}

export const ROLE_TEMPLATES: RoleTemplate[] = DEFS.map(build)

export const templatesFor = (scope: RoleTemplate["scope"]): RoleTemplate[] => ROLE_TEMPLATES.filter((t) => t.scope === scope)

/** Problems with the templates: unknown keys, patterns that match nothing, a level with nobody able to own it. Empty = fine. */
export function validateTemplates(templates: RoleTemplate[] = ROLE_TEMPLATES): string[] {
    const problems: string[] = []
    const seen = new Set<string>()
    for (const r of templates) {
        const id = `${r.scope}:${r.id}`
        if (seen.has(id)) problems.push(`duplicate template ${id}`)
        seen.add(id)
        if (r.permissions.length === 0) problems.push(`${id} has no permissions`)
        for (const k of r.permissions) {
            if (!isKnownKey(r.scope, k)) problems.push(`${id} holds unknown key "${k}"`)
        }
    }
    for (const def of DEFS) {
        const all = keysFor(def.scope)
        for (const p of def.include) {
            if (p === "*") continue
            if (expandPatterns(all, [p]).length === 0) problems.push(`${def.id}: "${p}" matches no key`)
        }
        for (const p of def.exclude ?? []) {
            if (expandPatterns(all, [p]).length === 0) problems.push(`${def.id}: exclude "${p}" matches no key`)
        }
    }
    // Business and shop sets must contain a role that can own the level, or nobody could be made owner
    for (const scope of ["BUSINESS", "SHOP"] as const) {
        const key = OWNERSHIP_KEY[scope]
        if (!templatesFor(scope).some((t) => holdsKey(t.permissions, key))) problems.push(`${scope}: no template holds ${key}`)
    }
    return problems
}
