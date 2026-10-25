// components/access/ThroughBusiness.tsx
// The collapsed "Through the business" block under a shop's team: the people of the business who work
// in every shop of it. Read-only here; they are managed in the business team. Shared by the shop's team
// page and the shop's team page in the Business area.
import Link from "next/link"

export type ThroughBusinessMember = { id: string; name: string | null; email: string; roleName: string }

export default function ThroughBusiness({
    members,
    businessName,
    manageHref,
}: {
    members: ThroughBusinessMember[]
    businessName: string
    /** where the whole business team is managed; omit when this person may not see it */
    manageHref?: string
}) {
    if (members.length === 0) return null
    return (
        <details className="rounded-xl border border-zinc-200 bg-white">
            <summary className="cursor-pointer list-none px-6 py-4 text-sm">
                <span className="font-medium text-zinc-900">Through the business</span>
                <span className="ml-2 text-zinc-400">
                    {members.length} {members.length === 1 ? "person" : "people"} who work in every shop of {businessName}
                </span>
            </summary>
            <div className="border-t border-zinc-100 px-6 pb-4">
                <p className="mt-4 text-sm text-zinc-500">They are managed by the business owner.</p>
                <ul className="mt-2 divide-y divide-zinc-100 text-sm">
                    {members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                            <span className="min-w-0 truncate font-medium text-zinc-900">{m.name || m.email}</span>
                            <span className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700">{m.roleName}</span>
                        </li>
                    ))}
                </ul>
                {manageHref && (
                    <Link href={manageHref} className="mt-4 inline-block text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
                        Manage the whole business team
                    </Link>
                )}
            </div>
        </details>
    )
}
