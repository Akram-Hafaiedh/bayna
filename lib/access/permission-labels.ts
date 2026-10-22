// lib/access/permission-labels.ts
// Plain words for permission keys, for the role editor. Pure (unit tested). Keys look like
// "module.resource.action"; the editor groups them by module, then resource, then action.

const MODULES: Record<string, string> = {
    business: "Business",
    shop: "Shop settings",
    product: "Products",
    pricing: "Pricing",
    inventory: "Inventory",
    order: "Orders",
    customer: "Customers",
    team: "Team",
    activity: "Activity log",
    insight: "Insights",
    billing: "Billing",
    support: "Support",
    feedback: "Feedback",
    notification: "Notifications",
    integration: "Integrations",
    review: "Reviews",
}

const ACTIONS: Record<string, string> = {
    view: "View",
    view_all: "View all",
    view_assigned: "View assigned",
    view_history: "View history",
    view_shop: "View shop's",
    create: "Create",
    edit: "Edit",
    edit_legal: "Edit legal details",
    delete: "Delete",
    archive: "Archive",
    restore: "Restore",
    publish: "Publish",
    manage: "Manage (add, change, remove)",
    update_role: "Change role",
    suspend: "Suspend and reinstate",
    remove: "Remove",
    invite: "Invite",
    transfer_ownership: "Transfer ownership",
    accept: "Accept",
    reject: "Reject",
    update_status: "Update status",
    assign: "Assign",
    cancel: "Cancel",
    refund: "Refund",
    export: "Export",
    import: "Import",
    send: "Send",
    reply: "Reply",
    message: "Message",
    comment: "Comment",
    vote: "Vote",
    close_temporarily: "Close temporarily",
    reopen: "Reopen",
    request: "Request",
}

const humanise = (s: string) => s.replace(/_/g, " ")
const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export const moduleTitle = (module: string): string => MODULES[module] ?? capitalise(humanise(module))
export const resourceTitle = (resource: string): string => capitalise(humanise(resource))
export const actionTitle = (action: string): string => ACTIONS[action] ?? capitalise(humanise(action))

/** "product.price.edit" -> "Edit, price (Products)": the tooltip of one permission. */
export function describeKey(key: string): string {
    if (key === "*") return "Everything, including permissions added later"
    const [module, resource, ...rest] = key.split(".")
    if (!module || !resource || rest.length === 0) return key
    return `${actionTitle(rest.join("."))}, ${humanise(resource)} (${moduleTitle(module)})`
}
