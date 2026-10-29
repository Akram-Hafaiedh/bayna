"use client"
// components/admin/UsersList.tsx
// One page of the platform's accounts, with one "..." menu per row (suspend, reinstate, sign out everywhere,
// force a password reset). The page loads the rows (search, filters and paging are in the address); what a menu
// offers comes from lib/user-status.ts, and the routes check the permission and the rules again.
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import RowMenu, { type RowMenuItem } from "@/components/ui/RowMenu"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import type { UserRow } from "@/lib/user-list"
import { userDetailPath } from "@/lib/user-detail"
import { USER_STATUS_LABEL, userActions, REASON_MAX, type UserStatusValue } from "@/lib/user-status"

const ROLE_BADGE: Record<string, string> = {
    ADMIN: "bg-violet-50 text-violet-700",
    PROVIDER: "bg-emerald-50 text-emerald-700",
}
const STATUS_BADGE: Record<UserStatusValue, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    SUSPENDED: "bg-red-50 text-red-700",
    BANNED: "bg-red-50 text-red-700",
    PENDING_DELETION: "bg-amber-50 text-amber-700",
}

type Dialog =
    | { kind: "suspend"; user: UserRow }
    | { kind: "ban"; user: UserRow }
    | { kind: "link"; user: UserRow; url: string; expires: string }
    | null

export default function UsersList({ users, me }: { users: UserRow[]; me: string }) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [busy, setBusy] = useState<string | null>(null)
    const [dialog, setDialog] = useState<Dialog>(null)
    const load = async () => router.refresh()

    async function call(user: UserRow, path: string, body?: unknown) {
        setBusy(user.id)
        try {
            const res = await fetch(`/api/admin/users/${user.id}/${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not do that", { description: data.error })
                return null
            }
            return data as Record<string, unknown>
        } catch {
            toast.error("Something went wrong")
            return null
        } finally {
            setBusy(null)
        }
    }

    const who = (u: UserRow) => u.name || u.email

    async function reinstate(u: UserRow) {
        if (await call(u, "reinstate")) {
            toast.success(`${who(u)} can sign in again`)
            await load()
        }
    }
    async function unban(u: UserRow) {
        const yes = await confirm({
            title: `Lift the ban on ${who(u)}?`,
            message: "They can sign in again with their password. Their old sessions stay ended.",
            confirmLabel: "Lift ban",
        })
        if (!yes) return
        if (await call(u, "unban")) {
            toast.success(`${who(u)} can sign in again`)
            await load()
        }
    }
    async function revoke(u: UserRow) {
        const yes = await confirm({
            title: `Sign ${who(u)} out everywhere?`,
            message: "Every device they are signed in on is signed out. Their account and password stay as they are.",
            confirmLabel: "Sign out everywhere",
            tone: "danger",
        })
        if (!yes) return
        const done = await call(u, "revoke-sessions")
        if (done) toast.success(`${who(u)} was signed out`, { description: `${done.revoked ?? 0} session(s) ended` })
    }
    async function resetLink(u: UserRow) {
        const yes = await confirm({
            title: `Force a password reset for ${who(u)}?`,
            message: "Their current password stops working and every session ends. You get a one-time link to give them; it works for 24 hours.",
            confirmLabel: "Create reset link",
            tone: "danger",
        })
        if (!yes) return
        const done = await call(u, "reset-link")
        if (done) setDialog({ kind: "link", user: u, url: String(done.url), expires: String(done.expires) })
    }

    function menuFor(u: UserRow): RowMenuItem[] {
        return userActions(u.status, u.id === me).map((a) => {
            if (a === "suspend") return { label: "Suspend", onClick: () => setDialog({ kind: "suspend", user: u }), danger: true }
            if (a === "reinstate") return { label: "Reinstate", onClick: () => void reinstate(u) }
            if (a === "ban") return { label: "Ban", onClick: () => setDialog({ kind: "ban", user: u }), danger: true }
            if (a === "unban") return { label: "Lift ban", onClick: () => void unban(u) }
            if (a === "revoke_sessions") return { label: "Sign out everywhere", onClick: () => void revoke(u) }
            return { label: "Force password reset", onClick: () => void resetLink(u), danger: true }
        })
    }

    return (
        <>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                        <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                            <th className="px-4 py-2.5 font-medium">User</th>
                            <th className="px-3 py-2.5 font-medium">Role</th>
                            <th className="px-3 py-2.5 font-medium">Status</th>
                            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Shops</th>
                            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Joined</th>
                            <th className="w-12 px-4 py-2.5"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {users.map((u) => (
                            <tr key={u.id} className="align-middle">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-zinc-900"><Link href={userDetailPath(u.publicUserId)} className="hover:underline">{u.name || "—"}</Link>{u.id === me && <span className="ml-2 text-xs font-normal text-zinc-400">you</span>}</p>
                                    <p className="text-xs text-zinc-400">{u.email}</p>
                                </td>
                                <td className="px-3 py-3">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-zinc-100 text-zinc-600"}`}>{u.role}</span>
                                </td>
                                <td className="px-3 py-3">
                                    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[u.status]}`}>{USER_STATUS_LABEL[u.status]}</span>
                                    {(u.status === "SUSPENDED" || u.status === "BANNED") && u.suspendedReason && (
                                        <p className="mt-0.5 max-w-[14rem] truncate text-xs text-zinc-400" title={u.suspendedReason}>{u.suspendedReason}</p>
                                    )}
                                </td>
                                <td className="hidden px-3 py-3 text-zinc-700 sm:table-cell">
                                    {u.providers.length > 0 ? (
                                        <ul className="space-y-0.5">
                                            {u.providers.map((p) => (
                                                <li key={p.id}>
                                                    {p.name}
                                                    {p.status === "PENDING" && <span className="ml-1 text-xs text-amber-600">(pending)</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className="hidden px-3 py-3 text-zinc-500 md:table-cell">{u.createdAt.slice(0, 10)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end">
                                        <RowMenu label={`Actions for ${who(u)}`} items={menuFor(u)} disabled={busy === u.id} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && <p className="px-5 py-8 text-center text-sm text-zinc-500">Nobody matches these filters.</p>}
            </div>

            {dialog?.kind === "suspend" && (
                <SuspendDialog
                    mode="suspend"
                    name={who(dialog.user)}
                    onClose={() => setDialog(null)}
                    onSubmit={async (reason) => {
                        const u = dialog.user
                        const done = await call(u, "suspend", { reason })
                        if (done) {
                            setDialog(null)
                            toast.success(`${who(u)} was suspended`, { description: "Their sessions were ended." })
                            await load()
                        }
                    }}
                />
            )}
            {dialog?.kind === "ban" && (
                <SuspendDialog
                    mode="ban"
                    name={who(dialog.user)}
                    onClose={() => setDialog(null)}
                    onSubmit={async (reason) => {
                        const u = dialog.user
                        const done = await call(u, "ban", { reason })
                        if (done) {
                            setDialog(null)
                            toast.success(`${who(u)} was banned`, { description: "Their sessions were ended." })
                            await load()
                        }
                    }}
                />
            )}
            {dialog?.kind === "link" && <LinkDialog name={who(dialog.user)} url={dialog.url} expires={dialog.expires} onClose={() => setDialog(null)} />}
        </>
    )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", key)
        return () => document.removeEventListener("keydown", key)
    }, [onClose])
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
                {children}
            </div>
        </div>
    )
}

function SuspendDialog({ mode, name, onClose, onSubmit }: { mode: "suspend" | "ban"; name: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
    const [reason, setReason] = useState("")
    const [saving, setSaving] = useState(false)
    const ban = mode === "ban"
    return (
        <Modal title={ban ? `Ban ${name}?` : `Suspend ${name}?`} onClose={onClose}>
            <p className="mt-2 text-sm text-zinc-500">
                {ban
                    ? "They cannot sign in and every open session ends now. The email stays taken, so they cannot register again with it. You can lift the ban later."
                    : "They cannot sign in and every open session ends now. You can reinstate the account later."}
            </p>
            <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="suspend-reason">Reason</label>
            <textarea
                id="suspend-reason"
                autoFocus
                rows={3}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={ban ? "Why is this account banned?" : "Why is this account suspended?"}
                className="mt-1.5 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-9 rounded-lg border border-zinc-200 px-4 text-sm text-zinc-700 hover:bg-zinc-50">Cancel</button>
                <button
                    type="button"
                    disabled={saving || reason.trim().length < 3}
                    onClick={async () => {
                        setSaving(true)
                        await onSubmit(reason)
                        setSaving(false)
                    }}
                    className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                    {saving ? (ban ? "Banning..." : "Suspending...") : ban ? "Ban account" : "Suspend account"}
                </button>
            </div>
        </Modal>
    )
}

function LinkDialog({ name, url, expires, onClose }: { name: string; url: string; expires: string; onClose: () => void }) {
    const [copied, setCopied] = useState(false)
    return (
        <Modal title={`Reset link for ${name}`} onClose={onClose}>
            <p className="mt-2 text-sm text-zinc-500">
                Give them this link. It is shown only now and works once, until {expires.slice(0, 16).replace("T", " ")} UTC. Their old password no longer works.
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
