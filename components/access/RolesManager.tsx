"use client"
// components/access/RolesManager.tsx
// The roles of one business or one shop: list, create, edit, clone, delete. The server page decides
// what this person may do and passes it in; the routes check everything again. Black and white like
// the rest of the site; ask with useConfirm, report with useToast.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import PermissionPicker from "./PermissionPicker"

export type RoleItem = {
    id: string
    name: string
    description: string | null
    permissions: string[]
    members: number
    invites: number
    /** this person may edit or delete it */
    editable: boolean
}

type Draft = { mode: "create" | "edit" | "view"; id: string | null; name: string; description: string; permissions: string[] }

const inputClass =
    "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"
const ghostBtn =
    "h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
const darkBtn = "h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"

export default function RolesManager({
    scope,
    targetId,
    title,
    note,
    roles,
    keys,
    grantable,
    canEverything,
    canManage,
}: {
    scope: "BUSINESS" | "SHOP"
    targetId: string
    title: string
    note?: string
    roles: RoleItem[]
    /** every permission that can be chosen here */
    keys: string[]
    /** the keys this person holds */
    grantable: string[]
    canEverything: boolean
    canManage: boolean
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [draft, setDraft] = useState<Draft | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const open = (d: Draft) => {
        setError(null)
        setDraft(d)
    }

    async function save() {
        if (!draft || draft.mode === "view") return
        setBusy("save")
        setError(null)
        try {
            const res = await fetch(draft.mode === "create" ? "/api/provider/roles" : `/api/provider/roles/${draft.id}`, {
                method: draft.mode === "create" ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope, targetId, name: draft.name, description: draft.description, permissions: draft.permissions }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Could not save the role")
                return
            }
            toast.success(draft.mode === "create" ? "Role created" : "Role saved")
            setDraft(null)
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    async function remove(r: RoleItem) {
        const ok = await confirm({
            title: `Delete the role "${r.name}"?`,
            message: "This cannot be undone. A role that people still hold cannot be deleted.",
            confirmLabel: "Delete",
            tone: "danger",
        })
        if (!ok) return
        setBusy(r.id)
        try {
            const res = await fetch(`/api/provider/roles/${r.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not delete the role", { description: data.error })
                return
            }
            toast.success("Role deleted")
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    return (
        <section className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
                    {note && <p className="text-xs text-zinc-500">{note}</p>}
                </div>
                {canManage && !draft && (
                    <button type="button" className="h-8 shrink-0 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800" onClick={() => open({ mode: "create", id: null, name: "", description: "", permissions: [] })}>
                        New role
                    </button>
                )}
            </div>

            {draft && (
                <div className="space-y-4 rounded-xl border border-zinc-300 bg-white p-5">
                    <p className="text-sm font-semibold text-zinc-900">
                        {draft.mode === "create" ? "New role" : draft.mode === "edit" ? `Edit ${draft.name}` : draft.name}
                    </p>
                    {draft.mode === "view" && <p className="text-xs text-zinc-500">You can look at this role but not change it: it holds access above yours.</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-zinc-700">
                            Name
                            <input className={`${inputClass} mt-1`} value={draft.name} maxLength={60} disabled={draft.mode === "view"} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                        </label>
                        <label className="block text-xs font-medium text-zinc-700">
                            Description (optional)
                            <input className={`${inputClass} mt-1`} value={draft.description} maxLength={200} disabled={draft.mode === "view"} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                        </label>
                    </div>
                    <PermissionPicker
                        keys={keys}
                        value={draft.permissions}
                        onChange={(permissions) => setDraft({ ...draft, permissions })}
                        grantable={grantable}
                        canEverything={canEverything}
                        readOnly={draft.mode === "view"}
                    />
                    {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                    <div className="flex gap-2">
                        {draft.mode !== "view" && (
                            <button type="button" className={darkBtn} disabled={busy === "save"} onClick={() => void save()}>
                                {busy === "save" ? "Saving..." : draft.mode === "create" ? "Create role" : "Save changes"}
                            </button>
                        )}
                        <button type="button" className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setDraft(null)}>
                            {draft.mode === "view" ? "Close" : "Cancel"}
                        </button>
                    </div>
                </div>
            )}

            {roles.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white px-5 py-6 text-center text-sm text-zinc-500">No roles yet.{canManage ? " Create the first one." : ""}</p>
            ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                    {roles.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-zinc-900">{r.name}</p>
                                {r.description && <p className="mt-0.5 text-xs text-zinc-500">{r.description}</p>}
                                <p className="mt-1 text-xs text-zinc-400">
                                    {r.permissions.includes("*") ? "Everything" : `${r.permissions.length} permissions`}
                                    {" · "}
                                    {r.members} {r.members === 1 ? "person" : "people"}
                                    {r.invites > 0 ? ` · ${r.invites} ${r.invites === 1 ? "invitation" : "invitations"} waiting` : ""}
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button type="button" className={ghostBtn} onClick={() => open({ mode: r.editable ? "edit" : "view", id: r.id, name: r.name, description: r.description ?? "", permissions: r.permissions })}>
                                    {r.editable ? "Edit" : "View"}
                                </button>
                                {canManage && (
                                    <button type="button" className={ghostBtn} disabled={!r.editable} title={r.editable ? undefined : "This role holds access above yours"} onClick={() => open({ mode: "create", id: null, name: `${r.name} (copy)`.slice(0, 60), description: r.description ?? "", permissions: r.permissions })}>
                                        Clone
                                    </button>
                                )}
                                {canManage && (
                                    <button type="button" className={ghostBtn} disabled={!r.editable || busy === r.id} onClick={() => void remove(r)}>
                                        Delete
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
