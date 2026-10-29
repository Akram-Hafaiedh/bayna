// app/api/admin/impersonation/start/route.ts
// POST { userId (the public user id), reason, password }: a platform staff member starts viewing the app as another
// person, read-only. Needs impersonation.session.start_readonly, a written reason (kept in the log) and the staff
// member's own password again. The viewed person is told that support looked at their account. Rules: lib/impersonation.ts.
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { requirePlatform } from "@/lib/access/guard"
import { prisma } from "@/lib/prisma"
import { logActivity, withAudit } from "@/lib/audit/run"
import { notify, notifications } from "@/lib/notifications"
import {
    DEFAULT_MINUTES, VIEW_AS_COOKIE, checkTarget, expiryFor, homeForViewedRole, parseStart, viewAsCookieValue,
} from "@/lib/impersonation"

export async function POST(req: Request) {
    try {
        const guard = await requirePlatform("impersonation.session.start_readonly", req)
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

        const parsed = parseStart(await req.json().catch(() => null))
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { userId: publicUserId, reason, password } = parsed.value

        const admin = await prisma.user.findUnique({ where: { id: guard.userId }, select: { password: true } })
        if (!admin?.password) return NextResponse.json({ error: "Password login is not available for this account" }, { status: 400 })
        if (!(await bcrypt.compare(password, admin.password))) {
            return NextResponse.json({ error: "Password is incorrect" }, { status: 400 })
        }

        const target = await prisma.user.findUnique({
            where: { publicUserId },
            select: {
                id: true, name: true, email: true, status: true, role: true, deletedAt: true,
                accessAssignments: { where: { scope: "PLATFORM" }, select: { id: true }, take: 1 },
            },
        })
        if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
        const rule = checkTarget(guard.userId, { ...target, hasPlatformRole: target.accessAssignments.length > 0 })
        if (!rule.ok) return NextResponse.json({ error: rule.error }, { status: 400 })

        const now = new Date()
        const expiresAt = expiryFor(now, DEFAULT_MINUTES)
        const done = await withAudit(guard.actor, async (tx) => {
            // One open session per admin. Sessions found past their time are closed first.
            await tx.impersonationSession.updateMany({
                where: { adminId: guard.userId, endedAt: null, expiresAt: { lte: now } },
                data: { endedAt: now, endedBy: "EXPIRED" },
            })
            const open = await tx.impersonationSession.findFirst({ where: { adminId: guard.userId, endedAt: null }, select: { id: true } })
            if (open) return { kind: "open" as const }

            const session = await tx.impersonationSession.create({
                data: {
                    adminId: guard.userId, targetUserId: target.id, mode: "READ_ONLY", reason, startedAt: now, expiresAt,
                    ip: guard.actor.ip ?? null, userAgent: guard.actor.userAgent ?? null,
                },
                select: { id: true },
            })
            await logActivity(tx, { ...guard.actor, onBehalfOfId: target.id, impersonationId: session.id }, {
                entityType: "User", entityId: target.id, action: "IMPERSONATION_START",
                note: `Viewed the account as ${target.name || target.email} (read-only): ${reason}`,
            })
            await notify(tx, target.id, notifications.supportViewedAccount())
            return { kind: "started" as const }
        })
        if (done.kind === "open") {
            return NextResponse.json({ error: "You already have a view open. Exit it first." }, { status: 409 })
        }

        const res = NextResponse.json({ redirect: homeForViewedRole(target.role), expiresAt: expiresAt.toISOString() })
        res.cookies.set(VIEW_AS_COOKIE, viewAsCookieValue("READ_ONLY", target.role), {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: process.env.NODE_ENV === "production",
            maxAge: DEFAULT_MINUTES * 60,
        })
        return res
    } catch (error) {
        console.error("Start view-as error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
