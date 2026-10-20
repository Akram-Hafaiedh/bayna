"use client"
// components/business/BusinessInviteForm.tsx
// One invitation form for the whole Business team page. A person can work in the business, in one or
// more shops, or in several places: tick every place they should work in and pick a role for each
// (business roles and shop roles are different lists, limited to what you may hand out there).
// Each ticked place gets its own invitation link, because a link grants one place. The server
// checks everything again, place by place.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import type { RoleChoice } from "@/components/provider/TeamSection"

export type InviteTarget = { id: string; scope: "BUSINESS" | "SHOP"; label: string; roles: RoleChoice[] }

const inputClass =
    "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"

const keyOf = (t: InviteTarget) => `${t.scope}:${t.id}`
const firstRole = (t: InviteTarget) => t.roles.find((r) => !r.isOwner)?.id ?? t.roles[0]?.id ?? ""

type Result = { key: string; label: string; roleName: string; url?: string; expiresAt?: string; error?: string }

export default function BusinessInviteForm({ targets }: { targets: InviteTarget[] }) {
    const router = useRouter()
    const toast = useToast()
    const [email, setEmail] = useState("")
    // which places are ticked, and the role chosen for each (a single place starts ticked)
    const [ticked, setTicked] = useState<Record<string, boolean>>(() => (targets.length === 1 ? { [keyOf(targets[0])]: true } : {}))
    const [roles, setRoles] = useState<Record<string, string>>(() => Object.fromEntries(targets.map((t) => [keyOf(t), firstRole(t)])))
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [done, setDone] = useState<{ email: string; results: Result[] } | null>(null)

    if (targets.length === 0) return null
    const chosen = targets.filter((t) => ticked[keyOf(t)])

    async function send(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        if (chosen.length === 0) {
            setError("Tick at least one place where this person will work.")
            return
        }
        setBusy(true)
        const results: Result[] = []
        for (const t of chosen) {
            const roleId = roles[keyOf(t)]
            const roleName = t.roles.find((r) => r.id === roleId)?.name ?? roleId
            try {
                const res = await fetch("/api/provider/team/invites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scope: t.scope, email, roleId, targetId: t.id }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) results.push({ key: keyOf(t), label: t.label, roleName, error: data.error || "Could not create the invitation" })
                else results.push({ key: keyOf(t), label: t.label, roleName, url: `${window.location.origin}/invite/${data.token}`, expiresAt: data.invite.expiresAt })
            } catch {
                results.push({ key: keyOf(t), label: t.label, roleName, error: "Something went wrong" })
            }
        }
        setBusy(false)
        const made = results.filter((r) => r.url).length
        if (made > 0) {
            setDone({ email, results })
            setEmail("")
            setTicked({})
            toast.success(made === 1 ? "Invitation link created" : `${made} invitation links created`, { description: "Copy them and send them to the person." })
            router.refresh()
        } else {
            setError(results.map((r) => `${r.label}: ${r.error}`).join(" "))
        }
        if (made > 0 && made < results.length) setError(results.filter((r) => r.error).map((r) => `${r.label}: ${r.error}`).join(" "))
    }

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text)
            toast.success("Link copied")
        } catch {
            toast.error("Could not copy", { description: "Select the link and copy it by hand." })
        }
    }

    const business = targets.filter((t) => t.scope === "BUSINESS")
    const shops = targets.filter((t) => t.scope === "SHOP")
    const row = (t: InviteTarget) => {
        const k = keyOf(t)
        return (
            <li key={k} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <label className="flex min-w-0 cursor-pointer items-center gap-2.5 text-sm text-zinc-900">
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                        checked={!!ticked[k]}
                        onChange={(e) => setTicked({ ...ticked, [k]: e.target.checked })}
                        disabled={busy}
                    />
                    <span className="truncate">{t.label}</span>
                </label>
                <select
                    aria-label={`Role in ${t.label}`}
                    className={`${inputClass} h-9 w-48`}
                    value={roles[k]}
                    onChange={(e) => setRoles({ ...roles, [k]: e.target.value })}
                    disabled={busy || !ticked[k]}
                >
                    {t.roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </li>
        )
    }

    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-900">Invite someone</h2>
            <p className="mt-1 text-sm text-zinc-500">
                Tick where they will work: the business (every shop), one shop, or several places at once. Each place has its own role.
            </p>
            <form className="mt-5 space-y-4" onSubmit={(e) => void send(e)}>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-zinc-700">Email of the person</span>
                    <input type="email" required className={`${inputClass} w-full max-w-sm`} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
                </label>

                <div>
                    <span className="mb-1 block text-xs font-medium text-zinc-700">Works in</span>
                    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 px-4">
                        {business.map(row)}
                        {shops.length > 0 && business.length > 0 && (
                            <li className="py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Shops</li>
                        )}
                        {shops.map(row)}
                    </ul>
                </div>

                <button type="submit" disabled={busy || !email.trim() || chosen.length === 0} className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                    {busy ? "Creating..." : chosen.length > 1 ? `Create ${chosen.length} invitation links` : "Create invitation link"}
                </button>
            </form>

            {error && (
                <div role="alert" className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</div>
            )}

            {done && (
                <div className="mt-4 space-y-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
                    <p className="text-sm font-medium text-zinc-900">Links for {done.email}</p>
                    <p className="text-xs text-zinc-500">
                        Send them yourself. Each works once, only for that email address. They are shown only now: if you lose one, make a new one.
                    </p>
                    {done.results.filter((r) => r.url).map((r) => (
                        <div key={r.key}>
                            <p className="mb-1 text-xs text-zinc-600">{r.label} as {r.roleName}, until {r.expiresAt?.slice(0, 10)}</p>
                            <div className="flex gap-2">
                                <input readOnly value={r.url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} />
                                <button type="button" className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" onClick={() => void copy(r.url!)}>Copy</button>
                            </div>
                        </div>
                    ))}
                    <button type="button" className="text-xs text-zinc-500 underline underline-offset-2" onClick={() => setDone(null)}>Hide</button>
                </div>
            )}
        </section>
    )
}
