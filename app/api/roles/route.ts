// app/api/roles/route.ts
// POST { scope: "BUSINESS" | "SHOP", targetId, name, description?, permissions[] }: create a role owned by
// that business or shop. Business roles need business.role.manage, shop roles team.role.manage in that
// shop. You can only give a role keys you hold yourself. Every role works the same way, whatever its name.
import { NextResponse } from "next/server"
import { withAudit, logActivity } from "@/lib/audit/run"
import { guardRoles } from "@/lib/access/role-actions"
import { roleNameFree } from "@/lib/access/role-seed"
import { checkRoleChange, parseRoleInput } from "@/lib/access/role-rules"
import { TeamError } from "@/lib/access/team-actions"

const ID = /^[A-Za-z0-9_-]{1,64}$/

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null)
        const scope = body?.scope
        const targetId = body?.targetId
        if ((scope !== "BUSINESS" && scope !== "SHOP") || typeof targetId !== "string" || !ID.test(targetId)) {
            return NextResponse.json({ error: "Say which business or shop the role is for" }, { status: 400 })
        }

        const parsed = parseRoleInput(body, scope)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { name, description, permissions } = parsed.value

        const guard = await guardRoles(scope === "BUSINESS" ? { scope, businessId: targetId } : { scope, shopId: targetId }, "manage", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const check = checkRoleChange({ can: guard.can, existing: null, next: permissions })
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

        const owner = scope === "BUSINESS" ? ({ scope, businessId: guard.businessId! } as const) : ({ scope, shopId: guard.shopId! } as const)
        const role = await withAudit(guard.actor, async (tx) => {
            if (!(await roleNameFree(tx, owner, name))) throw new TeamError("There is already a role with that name", 409)
            const created = await tx.accessRole.create({
                data: {
                    name,
                    description,
                    permissions,
                    scope,
                    businessId: scope === "BUSINESS" ? guard.businessId : null,
                    shopId: scope === "SHOP" ? guard.shopId : null,
                },
                select: { id: true, name: true },
            })
            await logActivity(tx, guard.actor, {
                entityType: "AccessRole",
                entityId: created.id,
                shopId: scope === "SHOP" ? guard.shopId : null,
                action: "TEAM_ROLE_CREATED",
                changes: [{ field: "role", from: null, to: `${name} (${permissions.includes("*") ? "everything" : `${permissions.length} permissions`})` }],
                note: `Created the role ${name}`,
            })
            return created
        })
        return NextResponse.json({ role }, { status: 201 })
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Create role error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
