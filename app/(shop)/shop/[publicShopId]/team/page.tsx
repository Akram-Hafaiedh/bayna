import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { auth } from "@/auth"
import { requireShopPage } from "@/lib/shop-auth"
import { shopPath } from "@/lib/shop-paths"
import { prisma } from "@/lib/prisma"
import { loadAccess } from "@/lib/access/load"
import { effective, has } from "@/lib/access/evaluate"
import { loadInvites, loadMembers, loadRoleOptions } from "@/lib/access/team"
import { teamPermission } from "@/lib/access/team-rules"
import { toInviteView, toMemberView, toRoleChoices } from "@/lib/access/team-view"
import TeamSection from "@/components/access/TeamSection"
import ThroughBusiness from "@/components/access/ThroughBusiness"

export const metadata: Metadata = { title: "Team" }

export default function ShopTeamPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <TeamContent params={params} />
            </Suspense>
        </div>
    )
}

async function TeamContent({ params }: { params: Promise<{ publicShopId: string }> }) {
    await connection()
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    if (shop?.status !== "ACTIVE" || !access) {
        return (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The team page opens once your shop is approved.
            </p>
        )
    }

    const found = await prisma.shop.findUnique({
        where: { id: shop.id },
        select: { name: true, businessId: true, business: { select: { id: true, name: true, deletedAt: true } } },
    })
    const business = found?.business && !found.business.deletedAt ? found.business : null

    // What this person may do, worked out the same way the routes do it
    const eff = effective(access.assignments, { shopId: shop.id, businessId: business?.id ?? null })
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
        loadMembers({ scope: "SHOP", shopId: shop.id }),
        can(teamPermission("SHOP", "invite")) ? loadInvites({ scope: "SHOP", shopId: shop.id }) : [],
        loadRoleOptions({ scope: "SHOP", shopId: shop.id, businessId: business?.id ?? null }),
        business ? loadMembers({ scope: "BUSINESS", businessId: business.id }) : [],
    ])

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Team</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Who works in {found?.name ?? "this shop"} and what they can do. Invitations are links you send yourself.
                    {can("team.role.view") && (
                        <>
                            {" "}What each role can do is on the{" "}
                            <Link href={shopPath(publicShopId, "roles")} className="underline underline-offset-2 hover:text-zinc-900">Roles page</Link>.
                        </>
                    )}
                </p>
            </div>

            <TeamSection
                scope="SHOP"
                targetId={shop.id}
                title={`Team of ${found?.name ?? "this shop"}`}
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
                footer={
                    business ? (
                        <ThroughBusiness members={throughBusiness} businessName={business.name} manageHref={canManageBusiness ? "/business/team" : undefined} />
                    ) : null
                }
            />
        </>
    )
}
