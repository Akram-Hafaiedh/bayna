// components/access/RoleNewContent.tsx
// Server part of the "New role" page, shared by the shop and the Business area. Works out where this
// person may create a role, fills the form in when cloning, and draws the editor.
import type { Access } from "@/lib/access/load"
import { loadEditorRole, type OwnerOption, type ViaShop } from "@/lib/access/role-pages"
import RoleEditor, { type EditorOwner } from "./RoleEditor"

export const toEditorOwner = (o: OwnerOption): EditorOwner => ({
    scope: o.scope,
    id: o.id,
    label: o.label,
    keys: o.keys,
    grantable: o.grantable,
    canEverything: o.canEverything,
})

export default async function RoleNewContent({
    access,
    owners,
    via,
    cloneId,
    preferOwnerId,
    backHref,
    teamHref,
}: {
    access: Access
    owners: OwnerOption[]
    via?: ViaShop | null
    cloneId?: string
    preferOwnerId?: string
    backHref: string
    teamHref: string
}) {
    const manageable = owners.filter((o) => o.canManage)
    if (manageable.length === 0) {
        return (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                You cannot create roles here. Ask an owner or manager.
            </p>
        )
    }

    let initial = { name: "", description: "", permissions: [] as string[], ownerId: preferOwnerId }
    if (cloneId) {
        const source = await loadEditorRole(access, cloneId, via)
        const target = source ? manageable.find((o) => o.id === source.owner.id) : undefined
        if (source && target) {
            // Only what this person may hand out is copied; the server checks again
            const may = (k: string) => target.canEverything || target.grantable.includes(k)
            initial = {
                name: `${source.name} (copy)`.slice(0, 60),
                description: source.description ?? "",
                permissions: source.permissions.filter(may),
                ownerId: target.id,
            }
        }
    }

    return <RoleEditor mode="create" owners={manageable.map(toEditorOwner)} initial={initial} backHref={backHref} teamHref={teamHref} />
}
