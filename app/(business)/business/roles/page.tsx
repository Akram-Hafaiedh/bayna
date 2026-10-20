import { Suspense } from "react"
import type { Metadata } from "next"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { groupPermissions, humanise } from "@/lib/access/role-view"

export const metadata: Metadata = { title: "Roles" }

export default function BusinessRolesPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <RolesContent />
            </Suspense>
        </div>
    )
}

async function RolesContent() {
    const { business } = await requireBusinessArea()
    // The business's own roles, and the roles of each of its shops
    const roles = await prisma.accessRole.findMany({
        where: { OR: [{ businessId: business.id }, { provider: { businessId: business.id } }] },
        orderBy: [{ scope: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, scope: true, permissions: true, provider: { select: { id: true, businessName: true } } },
    })
    const shops = [...new Map(roles.flatMap((r) => (r.scope === "SHOP" && r.provider ? [[r.provider.id, r.provider.businessName] as const] : []))).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
    const sections = [
        { title: "Business roles", note: "Owned by the business. Given for the whole business (their shop permissions then work in every shop) or for one of its shops.", rows: roles.filter((r) => r.scope === "BUSINESS") },
        ...shops.map(([id, name]) => ({
            title: `Roles of ${name}`,
            note: "Owned by this shop. Can only be given in this shop.",
            rows: roles.filter((r) => r.scope === "SHOP" && r.provider?.id === id),
        })),
    ]
    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Roles</h1>
                <p className="mt-1 text-sm text-zinc-500">What each role can do. Roles are given from the Team page. Creating and editing roles is coming next.</p>
            </div>
            {sections.map((s) => (
                <section key={s.title} className="space-y-2">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900">{s.title}</h2>
                        <p className="text-xs text-zinc-500">{s.note}</p>
                    </div>
                    {s.rows.length === 0 ? (
                        <p className="rounded-xl border border-zinc-200 bg-white px-5 py-6 text-center text-sm text-zinc-500">No roles yet.</p>
                    ) : (
                        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                            {s.rows.map((r) => (
                                <li key={r.id}>
                                    <details className="group px-5 py-3.5">
                                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-zinc-900">{r.name}</p>
                                                {r.description && <p className="mt-0.5 text-xs text-zinc-500">{r.description}</p>}
                                            </div>
                                            <span className="shrink-0 text-xs text-zinc-400 group-open:hidden">{r.permissions.length} permissions</span>
                                            <span className="hidden shrink-0 text-xs text-zinc-400 group-open:inline">Hide</span>
                                        </summary>
                                        <div className="mt-3 space-y-2.5 border-t border-zinc-100 pt-3">
                                            {groupPermissions(r.permissions).map((g) => (
                                                <div key={g.module}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{humanise(g.module)}</p>
                                                    <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
                                                        {g.items.map((i) => (
                                                            <li key={i.resource}>
                                                                <span className="text-zinc-900">{humanise(i.resource)}</span>: {i.actions.map(humanise).join(", ")}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </>
    )
}
