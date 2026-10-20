"use client"
// components/provider/TeamSection.tsx
// One team list: the people, the pending invitations, and the invite form, for one level (a shop or
// its business). The server page decides what this person may do and passes it in; the routes check
// everything again. Black and white like the rest of the site; ask with useConfirm, report with useToast.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"

export type TeamMemberView = {
    id: string
    name: string | null
    email: string
    roleId: string
    roleName: string
    status: "ACTIVE" | "SUSPENDED" | "INVITED"
    accountClosed: boolean
    since: string
    isYou: boolean
    /** the person's access is not above yours, so you may change them (or you are looking at yourself) */
    manageable: boolean
}

export type TeamInviteView = {
    id: string
    email: string
    roleId: string
    roleName: string
    state: "pending" | "expired"
    expiresAt: string
    invitedByName: string | null
    manageable: boolean
}

export type RoleChoice = { id: string; name: string; description: string | null; /** holds the ownership key: never the default choice */ isOwner: boolean }

export type TeamCan = { invite: boolean; setRole: boolean; suspend: boolean; remove: boolean }

const inputClass =
    "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"
const ghostBtn =
    "h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"

function day(iso: string) {
    return iso.slice(0, 10)
}

export default function TeamSection({
    scope,
    title,
    subtitle,
    members,
    invites,
    roles,
    can,
    targetId,
    hideInviteForm,
}: {
    scope: "SHOP" | "BUSINESS"
    title: string
    subtitle: string
    members: TeamMemberView[]
    invites: TeamInviteView[]
    /** roles this person may hand out (the same list is used for invitations and role changes) */
    roles: RoleChoice[]
    can: TeamCan
    /** the shop or business this list is about; leave out for "the one I am working in" */
    targetId?: string
    /** hide this list's own invite form (the Business team page has one form for every place) */
    hideInviteForm?: boolean
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [email, setEmail] = useState("")
    const [roleId, setRoleId] = useState(roles.find((r) => !r.isOwner)?.id ?? roles[0]?.id ?? "")
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState("")
    const [link, setLink] = useState<{ email: string; url: string; expiresAt: string } | null>(null)

    async function sendInvite(toEmail: string, toRole: string) {
        setError("")
        setBusy("invite")
        try {
            const res = await fetch("/api/provider/team/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope, email: toEmail, roleId: toRole, targetId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Could not create the invitation")
                return
            }
            setLink({ email: data.invite.email, url: `${window.location.origin}/invite/${data.token}`, expiresAt: data.invite.expiresAt })
            setEmail("")
            toast.success("Invitation link created", { description: "Copy it and send it to the person." })
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text)
            toast.success("Link copied")
        } catch {
            toast.error("Could not copy", { description: "Select the link and copy it by hand." })
        }
    }

    async function call(id: string, init: RequestInit, done: string) {
        setBusy(id)
        try {
            const res = await fetch(`/api/provider/team/members/${id}`, {
                ...init,
                headers: { "Content-Type": "application/json" },
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not do that", { description: data.error })
                return false
            }
            toast.success(done)
            router.refresh()
            return true
        } catch {
            toast.error("Something went wrong")
            return false
        } finally {
            setBusy(null)
        }
    }

    async function changeRole(m: TeamMemberView, key: string) {
        if (key === m.roleId) return
        const next = roles.find((r) => r.id === key)
        if (!next) return
        const ok = await confirm({
            title: `Change ${m.name || m.email} to ${next.name}?`,
            message: next.description ?? undefined,
            confirmLabel: "Change role",
        })
        if (ok) await call(m.id, { method: "PATCH", body: JSON.stringify({ action: "set_role", roleId: key }) }, "Role changed")
    }

    async function suspendOrReinstate(m: TeamMemberView) {
        const suspending = m.status !== "SUSPENDED"
        if (suspending) {
            const ok = await confirm({
                title: `Suspend ${m.name || m.email}?`,
                message: "They keep their place on the team but cannot work here until you reinstate them.",
                confirmLabel: "Suspend",
                tone: "danger",
            })
            if (!ok) return
        }
        await call(m.id, { method: "PATCH", body: JSON.stringify({ action: suspending ? "suspend" : "reinstate" }) }, suspending ? "Suspended" : "Reinstated")
    }

    async function remove(m: TeamMemberView) {
        const ok = await confirm({
            title: m.isYou ? "Leave this team?" : `Remove ${m.name || m.email}?`,
            message: m.isYou
                ? "You will lose access to it. An owner has to invite you again to come back."
                : "They lose access straight away. Their past work stays in the activity history.",
            confirmLabel: m.isYou ? "Leave" : "Remove",
            tone: "danger",
        })
        if (ok) await call(m.id, { method: "DELETE" }, m.isYou ? "You left the team" : "Removed")
    }

    async function cancelInvite(i: TeamInviteView) {
        const ok = await confirm({
            title: `Cancel the invitation for ${i.email}?`,
            message: "The link stops working.",
            confirmLabel: "Cancel invitation",
            tone: "danger",
        })
        if (!ok) return
        setBusy(i.id)
        try {
            const res = await fetch(`/api/provider/team/invites/${i.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not cancel", { description: data.error })
                return
            }
            toast.success("Invitation cancelled")
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>

            {can.invite && roles.length > 0 && !hideInviteForm && (
                <form
                    className="mt-5 flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void sendInvite(email, roleId)
                    }}
                >
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-zinc-700">Email of the person</span>
                        <input
                            type="email"
                            required
                            className={`${inputClass} w-64`}
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={busy === "invite"}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-zinc-700">Role</span>
                        <select className={inputClass} value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={busy === "invite"}>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="submit"
                        disabled={busy === "invite" || !email.trim()}
                        className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                        {busy === "invite" ? "Creating..." : "Create invitation link"}
                    </button>
                </form>
            )}
            {roles.find((r) => r.id === roleId)?.description && can.invite && !hideInviteForm && (
                <p className="mt-2 text-xs text-zinc-500">{roles.find((r) => r.id === roleId)?.description}</p>
            )}
            {error && (
                <div role="alert" className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                </div>
            )}

            {link && (
                <div className="mt-4 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
                    <p className="text-sm font-medium text-zinc-900">Link for {link.email}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                        Send it to them yourself. It works once, only for that email address, until {day(link.expiresAt)}.
                        It is shown only now: if you lose it, make a new one.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} />
                        <button type="button" className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" onClick={() => void copy(link.url)}>
                            Copy
                        </button>
                    </div>
                    <button type="button" className="mt-2 text-xs text-zinc-500 underline underline-offset-2" onClick={() => setLink(null)}>
                        Hide
                    </button>
                </div>
            )}

            <ul className="mt-6 divide-y divide-zinc-100 text-sm">
                {members.length === 0 && <li className="py-3 text-zinc-500">Nobody yet.</li>}
                {members.map((m) => {
                    const canChange = m.manageable && !m.isYou
                    return (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-zinc-900">
                                    {m.name || m.email}
                                    {m.isYou && <span className="ml-2 text-xs font-normal text-zinc-400">you</span>}
                                </p>
                                {m.name && <p className="truncate text-xs text-zinc-500">{m.email}</p>}
                                <p className="mt-0.5 text-xs text-zinc-400">On the team since {day(m.since)}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {m.status === "SUSPENDED" && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">Suspended</span>}
                                {m.accountClosed && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">Account closed</span>}
                                {can.setRole && canChange ? (
                                    <select
                                        aria-label={`Role of ${m.name || m.email}`}
                                        className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-800"
                                        value={roles.some((r) => r.id === m.roleId) ? m.roleId : ""}
                                        disabled={busy === m.id}
                                        onChange={(e) => void changeRole(m, e.target.value)}
                                    >
                                        {!roles.some((r) => r.id === m.roleId) && <option value="" disabled>{m.roleName}</option>}
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700">{m.roleName}</span>
                                )}
                                {can.suspend && canChange && (
                                    <button className={ghostBtn} disabled={busy === m.id} onClick={() => void suspendOrReinstate(m)}>
                                        {m.status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                                    </button>
                                )}
                                {can.remove && m.manageable && (
                                    <button className={ghostBtn} disabled={busy === m.id} onClick={() => void remove(m)}>
                                        {m.isYou ? "Leave" : "Remove"}
                                    </button>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ul>

            {invites.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-zinc-900">Waiting to join</h3>
                    <ul className="mt-2 divide-y divide-zinc-100 text-sm">
                        {invites.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-zinc-900">{i.email}</p>
                                    <p className="text-xs text-zinc-500">
                                        {i.roleName}
                                        {i.invitedByName ? `, invited by ${i.invitedByName}` : ""}
                                        {i.state === "expired" ? `, expired ${day(i.expiresAt)}` : `, valid until ${day(i.expiresAt)}`}
                                    </p>
                                </div>
                                {can.invite && i.manageable && (
                                    <div className="flex gap-2">
                                        <button className={ghostBtn} disabled={busy === "invite"} onClick={() => void sendInvite(i.email, i.roleId)}>
                                            New link
                                        </button>
                                        <button className={ghostBtn} disabled={busy === i.id} onClick={() => void cancelInvite(i)}>
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    )
}
