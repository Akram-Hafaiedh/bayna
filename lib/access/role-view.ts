// lib/access/role-view.ts
// Turns a role's permission keys ("module.resource.action") into groups a person can read:
// product → catalogue: view, create, edit. Pure (unit tested).

export type PermissionGroup = { module: string; items: { resource: string; actions: string[] }[] }

export function groupPermissions(keys: readonly string[]): PermissionGroup[] {
    const modules = new Map<string, Map<string, string[]>>()
    for (const key of [...keys].sort()) {
        const parts = key.split(".")
        if (parts.length < 3) continue // "*" and malformed keys have no module to group under
        const [module, resource, ...rest] = parts
        const action = rest.join(".")
        const resources = modules.get(module) ?? new Map<string, string[]>()
        const actions = resources.get(resource) ?? []
        if (!actions.includes(action)) actions.push(action)
        resources.set(resource, actions)
        modules.set(module, resources)
    }
    return [...modules].map(([module, resources]) => ({
        module,
        items: [...resources].map(([resource, actions]) => ({ resource, actions })),
    }))
}

/** "view_all" → "view all" */
export const humanise = (s: string) => s.replace(/_/g, " ")
