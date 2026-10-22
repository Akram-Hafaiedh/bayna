import { Suspense } from "react"
import type { Metadata } from "next"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { effective, has } from "@/lib/access/evaluate"
import { loadInvites, loadMembers, loadRoleOptions } from "@/lib/access/team"
import { teamPermission } from "@/lib/access/team-rules"
import { toInviteView, toMemberView, toRoleChoices } from "@/lib/access/team-view"
import { groupPeople, type PersonRow } from "@/lib/access/people"
import TeamSection from "@/components/provider/TeamSection"
import BusinessInviteForm, { type InviteTarget } from "@/components/business/BusinessInviteForm"

export const metadata: Metadata = { title: "Business team" }

export default function BusinessTeamPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <TeamContent />
            </Suspense>
        </div>
    )
}

async function TeamContent() {
    const { business, access, userId } = await requireBusinessArea()

    const bizEff = effective(access.assignments, { businessId: business.id })
    const canBiz = (k: string) => has(bizEff, k)

    if (!canBiz(teamPermission("BUSINESS", "view"))) {
        return (
            <>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Team</h1>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    The business team is managed by the business owner. Ask the owner if you need access.
                </p>
            </>
        )
    }

    // Shop-level teams can only be managed for shops that are live
    const shops = await prisma.shop.findMany({
        where: { businessId: business.id, deletedAt: null, isVerified: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, city: true },
    })

    const [bizRoles, bizMembers, bizInvites] = await Promise.all([
        loadRoleOptions({ scope: "BUSINESS", businessId: business.id }),
        loadMembers({ scope: "BUSINESS", businessId: business.id }),
        canBiz(teamPermission("BUSINESS", "invite")) ? loadInvites({ scope: "BUSINESS", businessId: business.id }) : [],
    ])

    // What this person may do in each shop of the business, worked out the way the routes do it
    const perShop = await Promise.all(
        shops.map(async (shop) => {
            const eff = effective(access.assignments, { providerId: shop.id, businessId: business.id })
            const can = (k: string) => has(eff, k)
            const visible = can(teamPermission("SHOP", "view"))
            const [members, invites, roles] = visible
                ? await Promise.all([
                    loadMembers({ scope: "SHOP", providerId: shop.id }),
                    can(teamPermission("SHOP", "invite")) ? loadInvites({ scope: "SHOP", providerId: shop.id }) : [],
                    // the shop's own roles plus the roles of the business
                    loadRoleOptions({ scope: "SHOP", providerId: shop.id, businessId: business.id }),
                ])
                : [[], [], []]
            return { shop, can, visible, members, invites, roles }
        })
    )

    // Everyone, in one list: business role plus the role in each shop
    const rows: PersonRow[] = [
        ...bizMembers.map((m) => ({
            userId: m.userId, name: m.name, email: m.email, roleName: m.roleName,
            shop: null, suspended: m.status === "SUSPENDED", accountClosed: m.accountClosed,
        })),
        ...perShop.flatMap((s) =>
            s.members.map((m) => ({
                userId: m.userId, name: m.name, email: m.email, roleName: m.roleName,
                shop: { id: s.shop.id, name: s.shop.name }, suspended: m.status === "SUSPENDED", accountClosed: m.accountClosed,
            }))
        ),
    ]
    const people = groupPeople(rows)

    // Where this person may invite, with the roles they may hand out in each place
    const bizRoleChoices = toRoleChoices(bizRoles, canBiz, "BUSINESS")
    const inviteTargets: InviteTarget[] = [
        ...(canBiz(teamPermission("BUSINESS", "invite")) && bizRoleChoices.length > 0
            ? [{ id: business.id, scope: "BUSINESS" as const, label: "The whole business", roles: bizRoleChoices }]
            : []),
        ...perShop.flatMap((s) => {
            const roles = toRoleChoices(s.roles, s.can, "SHOP")
            return s.visible && s.can(teamPermission("SHOP", "invite")) && roles.length > 0
                ? [{ id: s.shop.id, scope: "SHOP" as const, label: s.shop.name, roles }]
                : []
        }),
    ]

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Team</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Everyone who works in {business.name}, and what they can do. Invitations are links you send yourself.
                </p>
            </div>

            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-base font-semibold text-zinc-900">Everyone</h2>
                <p className="mt-1 text-sm text-zinc-500">Each person once, with their role in the business and in each shop. Change things in the sections below.</p>
                <ul className="mt-4 divide-y divide-zinc-100 text-sm">
                    {people.length === 0 && <li className="py-3 text-zinc-500">Nobody yet.</li>}
                    {people.map((p) => (
                        <li key={p.userId} className="py-3">
                            <p className="font-medium text-zinc-900">
                                {p.name || p.email}
                                {p.userId === userId && <span className="ml-2 text-xs font-normal text-zinc-400">you</span>}
                                {p.accountClosed && <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-normal text-zinc-700">Account closed</span>}
                            </p>
                            {p.name && <p className="text-xs text-zinc-500">{p.email}</p>}
                            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                                {p.businessRole && (
                                    <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-white">
                                        Business: {p.businessRole}{p.suspendedInBusiness ? " (suspended)" : ""}
                                    </span>
                                )}
                                {p.shopRoles.map((r) => (
                                    <span key={r.shopId} className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-zinc-700">
                                        {r.shopName}: {r.roleName}{r.suspended ? " (suspended)" : ""}
                                    </span>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <BusinessInviteForm targets={inviteTargets} />

            <TeamSection
                scope="BUSINESS"
                targetId={business.id}
                hideInviteForm
                title="Business team"
                subtitle="People who work in every shop of this business, such as owners and accountants."
                members={bizMembers.map((m) => toMemberView(m, canBiz, userId))}
                invites={bizInvites.map((i) => toInviteView(i, bizRoles, canBiz))}
                roles={toRoleChoices(bizRoles, canBiz, "BUSINESS")}
                can={{
                    invite: canBiz(teamPermission("BUSINESS", "invite")),
                    setRole: canBiz(teamPermission("BUSINESS", "set_role")),
                    suspend: canBiz(teamPermission("BUSINESS", "suspend")),
                    remove: canBiz(teamPermission("BUSINESS", "remove")),
                }}
            />

            <h2 className="pt-2 text-base font-semibold text-zinc-900">Shop teams</h2>
            {perShop.filter((s) => s.visible).length === 0 && (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">No live shops to manage yet.</p>
            )}
            {perShop.filter((s) => s.visible).map((s) => (
                <details key={s.shop.id} open={perShop.length === 1} className="group rounded-xl border border-zinc-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-sm">
                        <span className="min-w-0">
                            <span className="font-medium text-zinc-900">{s.shop.name}</span>
                            <span className="ml-2 text-zinc-400">{s.shop.city}</span>
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                            {s.members.length} {s.members.length === 1 ? "person" : "people"}
                            {s.invites.length > 0 ? `, ${s.invites.length} waiting` : ""}
                        </span>
                    </summary>
                    <div className="border-t border-zinc-100 p-2">
                        <TeamSection
                            scope="SHOP"
                            targetId={s.shop.id}
                            hideInviteForm
                            title={`Team of ${s.shop.name}`}
                            subtitle="People who work in this shop only."
                            members={s.members.map((m) => toMemberView(m, s.can, userId))}
                            invites={s.invites.map((i) => toInviteView(i, s.roles, s.can))}
                            roles={toRoleChoices(s.roles, s.can, "SHOP")}
                            can={{
                                invite: s.can(teamPermission("SHOP", "invite")),
                                setRole: s.can(teamPermission("SHOP", "set_role")),
                                suspend: s.can(teamPermission("SHOP", "suspend")),
                                remove: s.can(teamPermission("SHOP", "remove")),
                            }}
                        />
                    </div>
                </details>
            ))}
        </>
    )
}
