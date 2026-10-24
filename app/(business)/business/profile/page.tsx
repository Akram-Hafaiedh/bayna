import { Suspense } from "react"
import type { Metadata } from "next"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import BusinessForm from "@/components/business/BusinessForm"

export const metadata: Metadata = { title: "Business profile" }

export default function BusinessProfilePage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <ProfileContent />
            </Suspense>
        </div>
    )
}

async function ProfileContent() {
    const { business: chosen } = await requireBusinessArea()
    const business = await prisma.business.findUnique({
        where: { id: chosen.id },
        select: {
            id: true, name: true, legalName: true, taxId: true, registryNumber: true,
            billingEmail: true, billingPhone: true, billingAddress: true,
        },
    })
    if (!business) return null

    const perms = await businessCan(business.id, ["business.profile.view", "business.profile.edit", "business.profile.edit_legal"] as const)

    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Business profile</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    The company behind your shops: legal and billing details. Shop details (address, map pin, phone) are on each shop&apos;s profile.
                </p>
            </div>

            {!perms["business.profile.view"] ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Business details are managed by the business owner. Ask the owner if something needs to change.
                </p>
            ) : (
                <BusinessForm
                    key={business.id}
                    initial={{
                        name: business.name,
                        legalName: business.legalName ?? "",
                        taxId: business.taxId ?? "",
                        registryNumber: business.registryNumber ?? "",
                        billingEmail: business.billingEmail ?? "",
                        billingPhone: business.billingPhone ?? "",
                        billingAddress: business.billingAddress ?? "",
                    }}
                    canEdit={perms["business.profile.edit"]}
                    canEditLegal={perms["business.profile.edit_legal"]}
                />
            )}
        </>
    )
}
