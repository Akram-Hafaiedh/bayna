"use client"
// components/admin/StaffList.tsx
// The Staff page: the people who work for Bayna (one "..." menu per person: change role, suspend or reinstate,
// remove), the form to invite someone, and the invitations still waiting. The page loads the data; the routes
// under /api/admin/staff check the permission and the rules again (nobody changes themselves, nobody hands
// out more than they hold, the platform keeps an owner).
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import RowMenu, { type RowMenuItem } from "@/components/ui/RowMenu"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import type { StaffInviteRow, StaffMember, StaffRoleOption } from "@/lib/admin-staff"

const STATUS_BADGE: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    SUSPENDED: "bg-red-50 text-red-700",
    INVITED: "bg-amber-50 text-amber-700",
}
const input = "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"

type Dialog = { kind: "role"; member: StaffMember } | { kind: "link"; email: string; url: string; expires: string } | null

export default function StaffList({
    members, invites, roles, canGrant, canRevoke,
}: {
    members: StaffMember[]
    invites: StaffInviteRow[]
    roles: StaffRoleOption[]
    canGrant: boolean
    canRevoke: boolean
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [busy, setBusy] = useState<string | null>(null)
    const [dialog, setDialog] = useState<Dialog>(null)
    const [email, setEmail] = useState("")
    const [roleId, setRoleId] = useState("")
    const [inviting, setInviting] = useState(false)
    const [error, setError] = useState("")

    const who = (m: StaffMember) => m.name || m.email

    async function send(m: StaffMember, method: "PATCH" | "DELETE", body?: unknown) {
        setBusy(m.assignmentId)
        try {
            const res = await fetch(`/api/admin/staff/${m.assignmentId}`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not do that", { description: data.error })
                return false
            }
            router.refresh()
            return true
        } catch {
            toast.error("Something went wrong")
            return false
        } finally {
            setBusy(null)
        }
    }

    async function remove(m: StaffMember) {
        const yes = await confirm({
            title: `Remove ${who(m)} from the staff?`,
            message: "They lose all access to the admin area at once. Their account stays, as a plain client account.",
            confirmLabel: "Remove",
            tone: "danger",
        })
        if (yes && (await send(m, "DELETE"))) toast.success(`${who(m)} was removed from the staff`)
    }

    function menuFor(m: StaffMember): RowMenuItem[] {
        if (!m.canTouch) return []
        const items: RowMenuItem[] = []
        if (canGrant) items.push({ label: "Change role", onClick: () => setDialog({ kind: "role", member: m }) })
        if (canRevoke) {
            if (m.status === "SUSPENDED") {
                items.push({
                    label: "Reinstate",
                    onClick: () => void send(m, "PATCH", { action: "reinstate" }).then((ok) => ok && toast.success(`${who(m)} has access again`)),
                })
            } else {
                items.push({
                    label: "Suspend access",
                    danger: true,
                    onClick: () => void send(m, "PATCH", { action: "suspend" }).then((ok) => ok && toast.success(`${who(m)} was suspended`)),
                })
            }
            items.push({ label: "Remove from staff", danger: true, onClick: () => void remove(m) })
        }
        return items
    }

    async function invite(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setInviting(true)
        try {
            const res = await fetch("/api/admin/staff/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, roleId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Could not create the invitation")
                return
            }
            setDialog({ kind: "link", email, url: `${window.location.origin}/invite/${data.token}`, expires: String(data.invite?.expiresAt ?? "") })
            setEmail("")
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setInviting(false)
        }
    }

    async function cancel(i: StaffInviteRow) {
        const yes = await confirm({
            title: `Cancel the invitation for ${i.email}?`,
            message: "The link stops working. You can invite them again later.",
            confirmLabel: "Cancel invitation",
            tone: "danger",
        })
        if (!yes) return
        const res = await fetch(`/api/admin/staff/invites/${i.id}`, { method: "DELETE" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return toast.error("Could not cancel it", { description: data.error })
        toast.success("Invitation cancelled")
        router.refresh()
    }

    return (
        <>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead>
                        <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                            <th className="px-4 py-2.5 font-medium">Person</th>
                            <th className="px-3 py-2.5 font-medium">Role</th>
                            <th className="px-3 py-2.5 font-medium">Access</th>
                            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Since</th>
                            <th className="w-12 px-4 py-2.5"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {members.map((m) => {
                            const items = menuFor(m)
                            return (
                                <tr key={m.assignmentId} className="align-middle">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-zinc-900">{m.name || "—"}</p>
                                        <p className="text-xs text-zinc-400">{m.email}</p>
                                    </td>
                                    <td className="px-3 py-3 text-zinc-800">{m.roleName}</td>
                                    <td className="px-3 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[m.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                                            {m.status === "ACTIVE" ? "Active" : m.status === "SUSPENDED" ? "Suspended" : "Invited"}
                                        </span>
                                        {m.accountStatus !== "ACTIVE" && <p className="mt-0.5 text-xs text-zinc-400">Account {m.accountStatus.toLowerCase().replace("_", " ")}</p>}
                                    </td>
                                    <td className="hidden px-3 py-3 text-zinc-500 md:table-cell">{m.since.slice(0, 10)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end">
                                            {items.length > 0 && <RowMenu label={`Actions for ${who(m)}`} items={items} disabled={busy === m.assignmentId} />}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {members.length === 0 && <p className="px-5 py-8 text-center text-sm text-zinc-500">No staff yet.</p>}
            </div>

            {canGrant && (
                <section className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900">
                    <h2 className="text-base font-semibold text-zinc-900">Invite someone</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                        You get a link to send them. It works once, for their address only, for 7 days. Staff use their own account: an account that works in a shop cannot be staff.
                    </p>
                    <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_14rem_auto]">
                        <input type="email" required placeholder="name@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                        <select required aria-label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className={input}>
                            <option value="" disabled>Choose a role</option>
                            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button type="submit" disabled={inviting || !email || !roleId} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                            {inviting ? "Creating..." : "Create invitation"}
                        </button>
                    </form>
                    {roleId && <p className="mt-2 text-xs text-zinc-500">{roles.find((r) => r.id === roleId)?.description}</p>}
                    {error && <div role="alert" className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
                </section>
            )}

            {invites.length > 0 && (
                <section className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900">
                    <h2 className="text-base font-semibold text-zinc-900">Waiting for an answer</h2>
                    <ul className="mt-3 divide-y divide-zinc-100">
                        {invites.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                                <div>
                                    <p className="font-medium text-zinc-900">{i.email}</p>
                                    <p className="text-xs text-zinc-400">{i.roleName} &middot; valid until {i.expiresAt.slice(0, 10)}</p>
                                </div>
                                {canRevoke && (
                                    <button type="button" onClick={() => void cancel(i)} className="h-8 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 hover:bg-zinc-50">Cancel</button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {dialog?.kind === "role" && (
                <RoleDialog
                    name={who(dialog.member)}
                    current={dialog.member.roleId}
                    roles={roles}
                    onClose={() => setDialog(null)}
                    onSubmit={async (id) => {
                        const m = dialog.member
                        if (await send(m, "PATCH", { action: "set_role", roleId: id })) {
                            setDialog(null)
                            toast.success(`${who(m)}'s role was changed`)
                        }
                    }}
                />
            )}
            {dialog?.kind === "link" && <LinkDialog email={dialog.email} url={dialog.url} expires={dialog.expires} onClose={() => setDialog(null)} />}
        </>
    )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
        document.addEventListener("keydown", key)
        return () => document.removeEventListener("keydown", key)
    }, [onClose])
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-white p-6 text-zinc-900 shadow-xl">
                <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
                {children}
            </div>
        </div>
    )
}

function RoleDialog({ name, current, roles, onClose, onSubmit }: { name: string; current: string; roles: StaffRoleOption[]; onClose: () => void; onSubmit: (roleId: string) => Promise<void> }) {
    const [id, setId] = useState(current)
    const [saving, setSaving] = useState(false)
    return (
        <Modal title={`Change the role of ${name}`} onClose={onClose}>
            <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="staff-role">Role</label>
            <select id="staff-role" value={id} onChange={(e) => setId(e.target.value)} className={`${input} mt-1.5`}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="mt-2 text-xs text-zinc-500">{roles.find((r) => r.id === id)?.description}</p>
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-9 rounded-lg border border-zinc-200 px-4 text-sm text-zinc-700 hover:bg-zinc-50">Cancel</button>
                <button
                    type="button"
                    disabled={saving || id === current}
                    onClick={async () => {
                        setSaving(true)
                        await onSubmit(id)
                        setSaving(false)
                    }}
                    className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Change role"}
                </button>
            </div>
        </Modal>
    )
}

function LinkDialog({ email, url, expires, onClose }: { email: string; url: string; expires: string; onClose: () => void }) {
    const [copied, setCopied] = useState(false)
    return (
        <Modal title={`Invitation for ${email}`} onClose={onClose}>
            <p className="mt-2 text-sm text-zinc-500">
                Send them this link. It is shown only now. It works once, only for {email}{expires ? `, until ${expires.slice(0, 10)}` : ""}.
            </p>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="mt-4 h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-xs text-zinc-900" />
            <div className="mt-5 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(url)
                            setCopied(true)
                        } catch {
                            /* the field is selectable, so it can still be copied by hand */
                        }
                    }}
                    className="h-9 rounded-lg border border-zinc-200 px-4 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                    {copied ? "Copied" : "Copy link"}
                </button>
                <button type="button" onClick={onClose} className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">Done</button>
            </div>
        </Modal>
    )
}
