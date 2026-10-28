// app/api/admin/staff/invites/route.ts
// POST { email, roleId }: invite a person to work for Bayna with a platform role. Returns the link token ONCE
// (only its hash is stored); a new link for the same address replaces the older one. Needs
// access.assignment.grant, and you can only hand out a role whose every permission you hold yourself.
import { NextResponse } from "next/server"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"
import { withAudit, logActivity } from "@/lib/audit/run"
import { hashInviteToken, inviteExpiry, newInviteToken } from "@/lib/access/invite-token"
import { missingKeys } from "@/lib/access/team-rules"
import { checkStaffAccount, checkStaffInvitee, isPlatformRole, parseStaffInvite, staffPermission } from "@/lib/access/staff-rules"
import { STAFF_PLACE, worksInShopOrBusiness } from "@/lib/access/staff-actions"

export async function POST(req: Request) {
    try {
        const guard = await requirePlatform(staffPermission("invite"), req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const parsed = parseStaffInvite(await req.json().catch(() => null))
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { email, roleId } = parsed.value

        const role = await prisma.accessRole.findUnique({
            where: { id: roleId },
            select: { id: true, name: true, permissions: true, businessId: true, providerId: true },
        })
        if (!role || !isPlatformRole(role)) return NextResponse.json({ error: "Unknown role" }, { status: 400 })
        if (missingKeys(role.permissions, (k) => guard.can(k as never)).length > 0) {
            return NextResponse.json({ error: "You cannot invite someone to a role with more access than your own." }, { status: 403 })
        }

        const [actorUser, existing] = await Promise.all([
            prisma.user.findUnique({ where: { id: guard.userId }, select: { email: true } }),
            prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, status: true } }),
        ])
        const alreadyStaff = existing
            ? (await prisma.accessAssignment.count({ where: { userId: existing.id, scope: "PLATFORM" } })) > 0
            : false
        const who = checkStaffInvitee({
            inviteeEmail: email,
            actorEmail: actorUser?.email ?? null,
            existing: existing ? { status: existing.status, alreadyStaff } : null,
        })
        if (!who.ok) return NextResponse.json({ error: who.error }, { status: 400 })
        if (existing) {
            const account = checkStaffAccount(await worksInShopOrBusiness(prisma, existing.id))
            if (!account.ok) return NextResponse.json({ error: account.error }, { status: 400 })
        }

        const token = newInviteToken()
        const now = new Date()
        const expiresAt = inviteExpiry(now)

        const invite = await withAudit(guard.actor, async (tx) => {
            await tx.accessInvite.updateMany({
                where: { scope: "PLATFORM", email, status: "PENDING" },
                data: { status: "REVOKED", revokedAt: now },
            })
            const created = await tx.accessInvite.create({
                data: { scope: "PLATFORM", roleId: role.id, email, tokenHash: hashInviteToken(token), expiresAt, invitedById: guard.userId },
                select: { id: true },
            })
            await logActivity(tx, guard.actor, {
                entityType: "AccessInvite",
                entityId: created.id,
                action: "STAFF_INVITED",
                changes: [{ field: "invite", from: null, to: `${email} as ${role.name} in ${STAFF_PLACE}` }],
                note: `Invited ${email} to ${STAFF_PLACE} as ${role.name}`,
            })
            return created
        })

        return NextResponse.json({ invite: { id: invite.id, email, roleName: role.name, expiresAt }, token }, { status: 201 })
    } catch (error) {
        console.error("Create staff invite error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
