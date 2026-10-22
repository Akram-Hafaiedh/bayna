// components/access/RoleEditContent.tsx
// Server part of the "Edit role" page, shared by the shop and the Business area: loads the role, decides
// between editing and looking, and draws the editor. A role this person may not look at is "not found".
import { notFound } from "next/navigation"
import type { Access } from "@/lib/access/load"
import { loadEditorRole, type ViaShop } from "@/lib/access/role-pages"
import { roleInUseMessage } from "@/lib/access/role-rules"
import RoleEditor from "./RoleEditor"
import { toEditorOwner } from "./RoleNewContent"

export default async function RoleEditContent({
    access,
    roleId,
    via,
    backHref,
    teamHref,
}: {
    access: Access
    roleId: string
    via?: ViaShop | null
    backHref: string
    teamHref: string
}) {
    const role = await loadEditorRole(access, roleId, via)
    if (!role) notFound()
    return (
        <RoleEditor
            mode={role.editable ? "edit" : "view"}
            owners={[toEditorOwner(role.owner)]}
            role={{ id: role.id, members: role.members, invites: role.invites }}
            initial={{ name: role.name, description: role.description ?? "", permissions: role.permissions }}
            backHref={backHref}
            teamHref={teamHref}
            inUseNote={roleInUseMessage({ members: role.members, invites: role.invites })}
        />
    )
}
