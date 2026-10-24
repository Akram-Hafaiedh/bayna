// app/api/invites/accept/route.ts
// POST { token }: the signed-in person accepts an invitation link.
// The link is bound to one email address, so it only works for a person signed in with that address.
// Accepting creates the assignment (or updates an existing one), marks the invitation used, makes
// the person a "provider" for routing if they were a plain client, and tells the person who invited them.
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { requestMeta, type AuditActor } from "@/lib/audit/actor"
import { withAudit, logActivity } from "@/lib/audit/run"
import { hashInviteToken, inviteState, isPlausibleToken } from "@/lib/access/invite-token"
import { ACCEPT_ERRORS, checkAcceptable } from "@/lib/access/invite-accept"
import { assertTeamKeepsOwner, targetLabel, TeamError } from "@/lib/access/team-actions"
import { notifications, notify, shopPublicIds } from "@/lib/notifications"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: "Sign in to accept the invitation" }, { status: 401 })

        const body = await req.json().catch(() => null)
        const token = typeof body?.token === "string" ? body.token : ""
        if (!isPlausibleToken(token)) return NextResponse.json({ error: "This invitation link is not valid" }, { status: 404 })

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, name: true, email: true, role: true, status: true, deletedAt: true },
        })
        if (!user) return NextResponse.json({ error: ACCEPT_ERRORS.account }, { status: 403 })

        const invite = await prisma.accessInvite.findUnique({
            where: { tokenHash: hashInviteToken(token) },
            select: {
                id: true, scope: true, providerId: true, businessId: true, email: true, status: true, expiresAt: true, invitedById: true,
                role: { select: { id: true, name: true, permissions: true, businessId: true, providerId: true } },
                provider: { select: { id: true, businessId: true, deletedAt: true } },
                business: { select: { id: true, deletedAt: true } },
            },
        })
        if (!invite || invite.scope === "PLATFORM") return NextResponse.json({ error: "This invitation link is not valid" }, { status: 404 })

        const scope = invite.scope
        const verdict = checkAcceptable({
            state: inviteState(invite),
            inviteEmail: invite.email,
            userEmail: user.email,
            targetGone: scope === "SHOP" ? !invite.provider || !!invite.provider.deletedAt : !invite.business || !!invite.business.deletedAt,
            accountActive: user.status === "ACTIVE" && !user.deletedAt,
        })
        if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status })

        const levelId = (scope === "SHOP" ? invite.providerId : invite.businessId)!
        const label = await targetLabel(prisma, scope, levelId)
        const actor: AuditActor = {
            actorId: user.id,
            actorName: user.name || user.email,
            actorRole: "invitee",
            source: "WEB",
            ...requestMeta(req),
        }

        await withAudit(actor, async (tx) => {
            // Claim the invitation first: if two requests race, only one gets past this line
            const claimed = await tx.accessInvite.updateMany({
                where: { id: invite.id, status: "PENDING" },
                data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: user.id },
            })
            if (claimed.count === 0) throw new TeamError(ACCEPT_ERRORS.accepted, 409)

            const existing = await tx.accessAssignment.findFirst({
                where: scope === "SHOP" ? { userId: user.id, scope, providerId: levelId } : { userId: user.id, scope, businessId: levelId },
                select: { id: true },
            })
            if (existing) {
                // A second invitation to someone already on the team sets their role (and ends a suspension).
                // It must not strip the last owner.
                const owner = await assertTeamKeepsOwner(
                    tx,
                    scope === "SHOP"
                        ? { scope, providerId: levelId, businessId: invite.provider?.businessId ?? null }
                        : { scope, businessId: levelId },
                    { type: "set_role", assignmentId: existing.id, newPermissions: invite.role.permissions }
                )
                if (!owner.ok) throw new TeamError(owner.error, 409)
                await tx.accessAssignment.update({ where: { id: existing.id }, data: { roleId: invite.role.id, status: "ACTIVE" } })
            } else {
                await tx.accessAssignment.create({
                    data: {
                        userId: user.id,
                        roleId: invite.role.id,
                        scope,
                        providerId: scope === "SHOP" ? levelId : null,
                        businessId: scope === "BUSINESS" ? levelId : null,
                        status: "ACTIVE",
                        invitedById: invite.invitedById,
                    },
                })
            }

            // The role only decides which dashboard opens; permissions come from the assignment
            if (user.role === "CLIENT") await tx.user.update({ where: { id: user.id }, data: { role: "PROVIDER" } })

            await logActivity(tx, actor, {
                entityType: "AccessAssignment",
                entityId: existing?.id ?? null,
                providerId: scope === "SHOP" ? levelId : null,
                action: "TEAM_JOINED",
                changes: [{ field: "member", from: null, to: `${user.name || user.email} (${invite.role.name})` }],
                note: `${user.name || user.email} accepted an invitation to ${label} as ${invite.role.name}`,
            })
            if (invite.invitedById) {
                await notify(tx, invite.invitedById, notifications.teamJoined({ who: user.name || user.email, where: label, role: invite.role.name, shop: scope === "SHOP" ? (await shopPublicIds(tx, [levelId])).get(levelId) ?? null : null }))
            }
        })

        // Which shop to open: the shop itself, or the first live shop of the business
        const shop =
            scope === "SHOP"
                ? await prisma.shop.findFirst({ where: { id: levelId, isVerified: true, deletedAt: null }, select: { id: true } })
                : await prisma.shop.findFirst({
                    where: { businessId: levelId, isVerified: true, deletedAt: null },
                    orderBy: { id: "asc" },
                    select: { id: true },
                })
        return NextResponse.json({ ok: true, where: label, role: invite.role.name, shopId: shop?.id ?? null })
    } catch (error) {
        if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error("Accept invite error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
