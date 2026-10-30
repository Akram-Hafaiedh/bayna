import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { effective, has } from "@/lib/access/evaluate"
import { loadInvites, loadMembers, loadRoleOptions } from "@/lib/access/team"
import { teamPermission } from "@/lib/access/team-rules"
import { toInviteView, toMemberView, toRoleChoices } from "@/lib/access/team-view"
import TeamSection from "@/components/access/TeamSection"
import ThroughBusiness from "@/components/access/ThroughBusiness"

export const metadata: Metadata = { title: "Shop team" }

// The team of one shop, managed from the Business area. Same checks as the shop's own team page, worked
// out through the person's business-level role; the routes check everything again.
export default function BusinessShopTeamPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopTeamContent params={params} />
            </Suspense>
        </div>
    )
}

async function ShopTeamContent({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    const { business, access, userId } = await requireBusinessArea()

    const shop = await prisma.shop.findFirst({
        where: { publicShopId, businessId: business.id, deletedAt: null },
        select: { id: true, name: true, status: true },
    })
    if (!shop) notFound()

    const eff = effective(access.assignments, { shopId: shop.id, businessId: business.id })
    const can = (k: string) => has(eff, k)
    const bizEff = effective(access.assignments, { businessId: business.id })
    const canManageBusiness = has(bizEff, teamPermission("BUSINESS", "view"))

    // Teams are managed for live shops only
    if (shop.status !== "ACTIVE") {
        return (
            <>
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    The team of a shop can be managed once the shop is active.
                </p>
            </>
        )
    }

    if (!can(teamPermission("SHOP", "view"))) {
        return (
            <>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    You do not have access to this shop&apos;s team list. Ask an owner.
                </p>
            </>
        )
    }

    const [members, invites, roles, throughBusiness] = await Promise.all([
        loadMembers({ scope: "SHOP", shopId: shop.id }),
        can(teamPermission("SHOP", "invite")) ? loadInvites({ scope: "SHOP", shopId: shop.id }) : [],
        loadRoleOptions({ scope: "SHOP", shopId: shop.id, businessId: business.id }),
        loadMembers({ scope: "BUSINESS", businessId: business.id }),
    ])

    return (
        <>
            <TeamSection
                scope="SHOP"
                targetId={shop.id}
                title={`Team of ${shop.name}`}
                subtitle="People who work in this shop only. Invitations are links you send yourself."
                members={members.map((m) => toMemberView(m, can, userId))}
                invites={invites.map((i) => toInviteView(i, roles, can))}
                roles={toRoleChoices(roles, can, "SHOP")}
                can={{
                    invite: can(teamPermission("SHOP", "invite")),
                    setRole: can(teamPermission("SHOP", "set_role")),
                    suspend: can(teamPermission("SHOP", "suspend")),
                    remove: can(teamPermission("SHOP", "remove")),
                }}
                footer={
                    <ThroughBusiness
                        members={throughBusiness}
                        businessName={business.name}
                        manageHref={canManageBusiness ? "/business/team" : undefined}
                    />
                }
            />
        </>
    )
}
