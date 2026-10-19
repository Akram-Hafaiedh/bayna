import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { normalizeEmail } from "@/lib/email-input"
import { hashInviteToken, inviteState, isPlausibleToken } from "@/lib/access/invite-token"
import InviteAccept from "@/components/InviteAccept"

export const metadata: Metadata = { title: "Invitation" }

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    return (
        <div className="mx-auto max-w-lg px-4 py-12">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-200" />}>
                <InviteContent params={params} />
            </Suspense>
        </div>
    )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            <div className="mt-3 space-y-3 text-sm text-zinc-600">{children}</div>
        </div>
    )
}

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
    await connection()
    const { token } = await params

    const invite = isPlausibleToken(token)
        ? await prisma.accessInvite.findUnique({
            where: { tokenHash: hashInviteToken(token) },
            select: {
                scope: true, email: true, status: true, expiresAt: true, invitedById: true,
                role: { select: { name: true, description: true } },
                provider: { select: { businessName: true, deletedAt: true } },
                business: { select: { name: true, deletedAt: true } },
            },
        })
        : null

    if (!invite || invite.scope === "PLATFORM") {
        return <Card title="This link does not work"><p>The invitation link is not valid. Ask the person who invited you for a new one.</p></Card>
    }

    const state = inviteState(invite)
    const target = invite.scope === "SHOP" ? invite.provider : invite.business
    const name = invite.scope === "SHOP" ? invite.provider?.businessName : invite.business?.name
    if (!target || target.deletedAt || !name) {
        return <Card title="This invitation is no longer available"><p>The {invite.scope === "SHOP" ? "shop" : "business"} no longer exists.</p></Card>
    }
    if (state !== "pending") {
        const why = state === "expired" ? "has expired" : state === "revoked" ? "was cancelled" : "was already used"
        return <Card title={`This invitation ${why}`}><p>Ask the person who invited you for a new link.</p></Card>
    }

    const inviter = invite.invitedById
        ? await prisma.user.findUnique({ where: { id: invite.invitedById }, select: { name: true, email: true } })
        : null
    const session = await auth()
    const signedInEmail = session?.user?.email ? normalizeEmail(session.user.email) : null

    return (
        <Card title={`Join ${name}`}>
            <p>
                {inviter ? <><span className="font-medium text-zinc-900">{inviter.name || inviter.email}</span> invited you</> : "You were invited"} to{" "}
                {invite.scope === "SHOP" ? "work in the shop" : "work in every shop of the business"}{" "}
                <span className="font-medium text-zinc-900">{name}</span> as{" "}
                <span className="font-medium text-zinc-900">{invite.role.name}</span>.
            </p>
            {invite.role.description && <p className="text-zinc-500">{invite.role.description}</p>}
            <p className="text-xs text-zinc-400">
                Sent to {invite.email}. Valid until {invite.expiresAt.toISOString().slice(0, 10)}.
            </p>
            <InviteAccept token={token} inviteEmail={invite.email} signedInEmail={signedInEmail} />
        </Card>
    )
}
