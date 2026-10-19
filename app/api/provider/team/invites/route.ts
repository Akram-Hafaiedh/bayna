// app/api/provider/team/invites/route.ts
// POST { scope: "SHOP" | "BUSINESS", email, roleKey }: invite someone to the shop you are working in, or
// to its business. Returns the link token ONCE: only its hash is stored, so a lost link is replaced
// by making a new one (which cancels the older one for the same person).
// Rules: you need the invite permission at that level, and you can only hand out a role whose every
// permission you hold yourself (a manager cannot invite an owner).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { guardTeam, targetLabel, TeamError } from "@/lib/access/team-actions"
import { hashInviteToken, inviteExpiry, newInviteToken } from "@/lib/access/invite-token"
import { missingKeys, parseInviteInput } from "@/lib/access/team-rules"

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null)
        const parsed = parseInviteInput(body)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { scope, email, roleKey, targetId } = parsed.value

        // A named shop or business (the Business area invites into any of its shops); otherwise the one
        // the person is working in. Either way they must really work there and hold the permission.
        const guard = await guardTeam(
            scope,
            "invite",
            req,
            scope === "SHOP" ? { providerId: targetId } : { businessId: targetId }
        )
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const role = await prisma.accessRole.findFirst({
            where: { scope, providerId: null, key: roleKey },
            select: { id: true, name: true, permissions: true },
        })
        if (!role) return NextResponse.json({ error: "Unknown role" }, { status: 400 })
        if (missingKeys(role.permissions, guard.can).length > 0) {
            return NextResponse.json({ error: "You cannot invite someone to a role with more access than your own." }, { status: 403 })
        }

        const target = scope === "SHOP" ? { scope, providerId: guard.providerId! } : { scope, businessId: guard.businessId! }
        const targetWhere = scope === "SHOP" ? { providerId: guard.providerId! } : { businessId: guard.businessId! }

        // Already working here? (emails are matched without regard to case, old accounts may be mixed-case)
        const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
        if (existing) {
            const member = await prisma.accessAssignment.findFirst({
                where: { userId: existing.id, scope, ...targetWhere },
                select: { status: true },
            })
            if (member) {
                const msg = member.status === "SUSPENDED"
                    ? "That person is already on the team but suspended. Reinstate them instead."
                    : "That person is already on the team. Change their role from the team list."
                return NextResponse.json({ error: msg }, { status: 400 })
            }
        }

        const token = newInviteToken()
        const now = new Date()
        const expiresAt = inviteExpiry(now)
        const label = await targetLabel(prisma, scope, scope === "SHOP" ? guard.providerId! : guard.businessId!)

        const invite = await withAudit(guard.actor, async (tx) => {
            // A new link for the same person replaces the older one
            await tx.accessInvite.updateMany({
                where: { ...targetWhere, scope, email, status: "PENDING" },
                data: { status: "REVOKED", revokedAt: now },
            })
            const created = await tx.accessInvite.create({
                data: {
                    ...target,
                    roleId: role.id,
                    email,
                    tokenHash: hashInviteToken(token),
                    expiresAt,
                    invitedById: guard.userId,
                },
                select: { id: true },
            })
            await logActivity(tx, guard.actor, {
                entityType: "AccessInvite",
                entityId: created.id,
                providerId: guard.providerId,
                action: "TEAM_INVITED",
                changes: [{ field: "invite", from: null, to: `${email} as ${role.name} in ${label}` }],
                note: `Invited ${email} to ${label} as ${role.name}`,
            })
            return created
        })

        return NextResponse.json({ invite: { id: invite.id, email, roleName: role.name, expiresAt }, token }, { status: 201 })
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Create invite error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
