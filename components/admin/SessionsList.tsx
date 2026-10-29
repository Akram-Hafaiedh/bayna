"use client"
// components/admin/SessionsList.tsx
// One page of "View as" sessions: who looked at whose account, why, when, and how it ended. An open session of
// someone else has an End now button for staff with impersonation.session.end_any (the route checks it again).
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import type { SessionRow } from "@/lib/admin-impersonation"
import { endedLabel, isSessionOpen } from "@/lib/impersonation-list"
import { userDetailPath } from "@/lib/user-detail"

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

export default function SessionsList({ sessions, me, canEnd, now: nowIso }: { sessions: SessionRow[]; me: string; canEnd: boolean; now: string }) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [busy, setBusy] = useState<string | null>(null)
    const now = new Date(nowIso).getTime()

    async function endNow(s: SessionRow) {
        const yes = await confirm({
            title: `End ${s.admin.name}'s view?`,
            message: `They are taken out of ${s.target.name}'s account at once and are themselves again. This is written in the log.`,
            confirmLabel: "End now",
            tone: "danger",
        })
        if (!yes) return
        setBusy(s.id)
        try {
            const res = await fetch(`/api/admin/impersonation/${s.id}/end`, { method: "POST" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not end it", { description: data.error })
                return
            }
            toast.success("The view was ended")
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[52rem] text-left text-sm">
                <thead>
                    <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-4 py-2.5 font-medium">Staff member</th>
                        <th className="px-3 py-2.5 font-medium">Viewed</th>
                        <th className="px-3 py-2.5 font-medium">Reason</th>
                        <th className="px-3 py-2.5 font-medium">Started</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="w-28 px-4 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {sessions.map((s) => {
                        const open = isSessionOpen(s, new Date(now))
                        return (
                            <tr key={s.id} className="align-top">
                                <td className="px-4 py-3 font-medium text-zinc-900">
                                    {s.admin.name}{s.admin.id === me && <span className="ml-2 text-xs font-normal text-zinc-400">you</span>}
                                </td>
                                <td className="px-3 py-3">
                                    {s.target.publicUserId
                                        ? <Link href={userDetailPath(s.target.publicUserId)} className="text-zinc-900 hover:underline">{s.target.name}</Link>
                                        : <span className="text-zinc-500">{s.target.name}</span>}
                                    <p className="text-xs text-zinc-400">{s.mode === "WRITE" ? "Can change things" : "Read-only"}</p>
                                </td>
                                <td className="max-w-xs px-3 py-3 text-zinc-600">{s.reason}</td>
                                <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                                    {when(s.startedAt)}
                                    {s.ip && <p className="text-xs text-zinc-400">{s.ip}</p>}
                                </td>
                                <td className="px-3 py-3">
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${open ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>
                                        {endedLabel(s, new Date(now))}
                                    </span>
                                    <p className="mt-1 text-xs text-zinc-400">{open ? `until ${when(s.expiresAt)}` : s.endedAt ? when(s.endedAt) : when(s.expiresAt)}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {open && canEnd && s.admin.id !== me && (
                                        <button
                                            type="button"
                                            disabled={busy === s.id}
                                            onClick={() => void endNow(s)}
                                            className="h-8 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            End now
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
