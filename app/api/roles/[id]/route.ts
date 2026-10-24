// app/api/roles/[id]/route.ts
//   PATCH { name, description?, permissions[] }   change a role (applies to everyone who holds it, at once)
//   DELETE                                         delete a role nobody uses
// Same rules as creating: you manage roles at that business or shop, you only give keys you hold, and
// you cannot change or delete a role that holds keys above you. A change cannot leave the level
// without an owner, and a role in use (people or waiting invitations) cannot be deleted.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { assertRoleEditKeepsOwner, guardRoles, roleUsage, targetOfRole } from "@/lib/access/role-actions"
import { roleNameFree } from "@/lib/access/role-seed"
import { checkRoleChange, checkRoleDelete, parseRoleInput, roleInUseMessage } from "@/lib/access/role-rules"
import { TeamError } from "@/lib/access/team-actions"

type Ctx = { params: Promise<{ id: string }> }

async function loadRole(id: string) {
    const role = await prisma.accessRole.findUnique({
        where: { id },
        select: { id: true, name: true, description: true, permissions: true, scope: true, businessId: true, providerId: true },
    })
    const target = role ? targetOfRole(role) : null
    return role && target ? { role, target } : null
}

export async function PATCH(req: Request, { params }: Ctx) {
    try {
        const { id } = await params
        const found = await loadRole(id)
        if (!found) return NextResponse.json({ error: "Role not found" }, { status: 404 })
        const { role, target } = found

        const parsed = parseRoleInput(await req.json().catch(() => null), target.scope)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const next = parsed.value

        const guard = await guardRoles(target, "manage", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const check = checkRoleChange({ can: guard.can, existing: role.permissions, next: next.permissions })
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

        const owner = target.scope === "BUSINESS" ? ({ scope: "BUSINESS", businessId: target.businessId } as const) : ({ scope: "SHOP", providerId: target.providerId } as const)
        await withAudit(guard.actor, async (tx) => {
            if (!(await roleNameFree(tx, owner, next.name, role.id))) throw new TeamError("There is already a role with that name", 409)
            const keeps = await assertRoleEditKeepsOwner(tx, role, next.permissions)
            if (!keeps.ok) throw new TeamError(keeps.error, 409)

            await tx.accessRole.update({ where: { id }, data: { name: next.name, description: next.description, permissions: next.permissions } })

            const added = next.permissions.filter((k) => !role.permissions.includes(k))
            const removed = role.permissions.filter((k) => !next.permissions.includes(k))
            const changes = [
                ...(role.name !== next.name ? [{ field: "name", from: role.name, to: next.name }] : []),
                ...(added.length || removed.length ? [{ field: "permissions", from: `${role.permissions.length}`, to: `${next.permissions.length} (+${added.length} -${removed.length})` }] : []),
            ]
            if (changes.length > 0) {
                await logActivity(tx, guard.actor, {
                    entityType: "AccessRole",
                    entityId: id,
                    providerId: role.providerId,
                    action: "TEAM_ROLE_UPDATED",
                    changes,
                    note: `Changed the role ${next.name}`,
                })
            }
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Update role error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: Ctx) {
    try {
        const { id } = await params
        const found = await loadRole(id)
        if (!found) return NextResponse.json({ error: "Role not found" }, { status: 404 })
        const { role, target } = found

        const guard = await guardRoles(target, "manage", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const allowed = checkRoleDelete({ can: guard.can, permissions: role.permissions })
        if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status })

        await withAudit(guard.actor, async (tx) => {
            // Checked inside the transaction so a person added a moment ago still counts
            const inUse = roleInUseMessage(await roleUsage(tx, id))
            if (inUse) throw new TeamError(inUse, 409)
            await tx.accessRole.delete({ where: { id } })
            await logActivity(tx, guard.actor, {
                entityType: "AccessRole",
                entityId: id,
                providerId: role.providerId,
                action: "TEAM_ROLE_DELETED",
                changes: [{ field: "role", from: role.name, to: null }],
                note: `Deleted the role ${role.name}`,
            })
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Delete role error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
