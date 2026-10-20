import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { auth } from "@/auth"
import { requireProvider } from "@/lib/provider-auth"
import { prisma } from "@/lib/prisma"
import { loadAccess } from "@/lib/access/load"
import { effective, has } from "@/lib/access/evaluate"
import { loadInvites, loadMembers, loadRoleOptions } from "@/lib/access/team"
import { teamPermission } from "@/lib/access/team-rules"
import { toInviteView, toMemberView, toRoleChoices } from "@/lib/access/team-view"
import TeamSection from "@/components/provider/TeamSection"

export const metadata: Metadata = { title: "Team" }

export default function ProviderTeamPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <TeamContent />
            </Suspense>
        </div>
    )
}

async function TeamContent() {
    await connection()
    const shop = await requireProvider()
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    if (!shop?.isVerified || !access) {
        return (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The team page opens once your shop is approved.
            </p>
        )
    }

    const found = await prisma.provider.findUnique({
        where: { id: shop.id },
        select: { businessName: true, businessId: true, business: { select: { id: true, name: true, deletedAt: true } } },
    })
    const business = found?.business && !found.business.deletedAt ? found.business : null

    // What this person may do, worked out the same way the routes do it
    const eff = effective(access.assignments, { providerId: shop.id, businessId: business?.id ?? null })
    const can = (k: string) => has(eff, k)
    const bizEff = business ? effective(access.assignments, { businessId: business.id }) : null
    const canManageBusiness = !!bizEff && has(bizEff, teamPermission("BUSINESS", "view"))

    if (!can(teamPermission("SHOP", "view"))) {
        return (
            <>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Team</h1>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    You do not have access to the team list. Ask an owner or manager.
                </p>
            </>
        )
    }

    const [members, invites, roles, throughBusiness] = await Promise.all([
        loadMembers({ scope: "SHOP", providerId: shop.id }),
        can(teamPermission("SHOP", "invite")) ? loadInvites({ scope: "SHOP", providerId: shop.id }) : [],
        loadRoleOptions({ scope: "SHOP", providerId: shop.id, businessId: business?.id ?? null }),
        business ? loadMembers({ scope: "BUSINESS", businessId: business.id }) : [],
    ])

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Team</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Who works in {found?.businessName ?? "this shop"} and what they can do. Invitations are links you send yourself.
                </p>
            </div>

            <TeamSection
                scope="SHOP"
                targetId={shop.id}
                title={`Team of ${found?.businessName ?? "this shop"}`}
                subtitle="People who work in this shop only. Pick the shop in the menu at the top left to see another one."
                members={members.map((m) => toMemberView(m, can, access.userId))}
                invites={invites.map((i) => toInviteView(i, roles, can))}
                roles={toRoleChoices(roles, can, "SHOP")}
                can={{
                    invite: can(teamPermission("SHOP", "invite")),
                    setRole: can(teamPermission("SHOP", "set_role")),
                    suspend: can(teamPermission("SHOP", "suspend")),
                    remove: can(teamPermission("SHOP", "remove")),
                }}
            />

            {business && throughBusiness.length > 0 && (
                <section className="rounded-xl border border-zinc-200 bg-white p-6">
                    <h2 className="text-base font-semibold text-zinc-900">Through the business</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                        These people work in every shop of {business.name}. They are managed by the business owner.
                    </p>
                    <ul className="mt-4 divide-y divide-zinc-100 text-sm">
                        {throughBusiness.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                                <span className="min-w-0 truncate font-medium text-zinc-900">{m.name || m.email}</span>
                                <span className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700">{m.roleName}</span>
                            </li>
                        ))}
                    </ul>
                    {canManageBusiness && (
                        <Link href="/business/team" className="mt-4 inline-block text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
                            Manage the whole business team
                        </Link>
                    )}
                </section>
            )}
        </>
    )
}
