import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import CreateShopForm from "@/components/business/CreateShopForm"

export const metadata: Metadata = { title: "Create shop" }

export default function NewShopPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <NewShopContent />
            </Suspense>
        </div>
    )
}

async function NewShopContent() {
    const { business, userId } = await requireBusinessArea()
    const [perms, waiting] = await Promise.all([
        businessCan(business.id, ["business.shop.create"] as const),
        // One application at a time (the same rule as the application route)
        prisma.shop.findFirst({
            where: { userId, status: { in: ["DRAFT", "PENDING"] }, deletedAt: null },
            select: { name: true, publicId: true, businessId: true },
        }),
    ])

    const back = (
        <Link href="/business/shops" className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
            All shops of {business.name}
        </Link>
    )
    const head = (
        <div>
            {back}
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Create a shop</h1>
            <p className="mt-1 text-sm text-zinc-500">A new shop of {business.name}. It shares the business&apos;s owners, legal details and plan.</p>
        </div>
    )

    if (!perms["business.shop.create"]) {
        return (
            <>
                {head}
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Adding a shop is for the business owner. Ask the owner if you need a new shop.
                </p>
            </>
        )
    }
    if (waiting) {
        return (
            <>
                {head}
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    You already have a shop waiting for approval: <span className="font-medium">{waiting.name}</span>. You can add another once an administrator has decided.
                    {waiting.businessId === business.id && (
                        <> <Link href={`/business/shops/${waiting.publicId}`} className="underline underline-offset-2">Open it</Link> to keep filling in its details.</>
                    )}
                </div>
            </>
        )
    }
    return (
        <>
            {head}
            <CreateShopForm businessId={business.id} />
        </>
    )
}
