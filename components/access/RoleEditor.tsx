"use client"
// components/access/RoleEditor.tsx
// One role on its own page: create, edit (or look at one this person may not change). The server page
// decides what this person may do and which keys they may hand out; the routes check it all again.
// Ask with useConfirm, report with useToast. Black and white like the rest of the site.
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { accessLabel, roleModules } from "@/lib/access/role-list"
import PermissionPicker from "./PermissionPicker"

export type EditorOwner = {
    scope: "BUSINESS" | "SHOP"
    id: string
    label: string
    keys: string[]
    grantable: string[]
    canEverything: boolean
}

const inputClass =
    "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"

export default function RoleEditor({
    mode,
    owners,
    role,
    initial,
    backHref,
    teamHref,
    inUseNote,
}: {
    mode: "create" | "edit" | "view"
    /** create: the places the role can belong to (pick one); edit and view: exactly one */
    owners: EditorOwner[]
    role?: { id: string; members: number; invites: number }
    initial: { name: string; description: string; permissions: string[]; ownerId?: string }
    backHref: string
    /** where the people holding roles are managed */
    teamHref: string
    /** set when the role cannot be deleted because it is in use */
    inUseNote?: string | null
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const readOnly = mode === "view"

    const [ownerId, setOwnerId] = useState(initial.ownerId && owners.some((o) => o.id === initial.ownerId) ? initial.ownerId : owners[0]?.id ?? "")
    const owner = owners.find((o) => o.id === ownerId) ?? owners[0]
    const [name, setName] = useState(initial.name)
    const [description, setDescription] = useState(initial.description)
    const [permissions, setPermissions] = useState(initial.permissions)
    const [busy, setBusy] = useState<"save" | "delete" | null>(null)
    const [error, setError] = useState<string | null>(null)

    const dirty = useMemo(
        () =>
            name !== initial.name ||
            description !== initial.description ||
            [...permissions].sort().join("|") !== [...initial.permissions].sort().join("|"),
        [name, description, permissions, initial]
    )

    // Leaving with unsaved changes asks the browser to confirm
    useEffect(() => {
        if (!dirty || busy) return
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault()
        }
        window.addEventListener("beforeunload", warn)
        return () => window.removeEventListener("beforeunload", warn)
    }, [dirty, busy])

    function chooseOwner(id: string) {
        const next = owners.find((o) => o.id === id)
        if (!next) return
        setOwnerId(id)
        // A business and a shop offer different permissions: keep only what the new place has
        setPermissions((p) => (p.includes("*") ? p : p.filter((k) => next.keys.includes(k))))
    }

    async function save() {
        if (!owner || readOnly) return
        setBusy("save")
        setError(null)
        try {
            const res = await fetch(mode === "create" ? "/api/roles" : `/api/roles/${role?.id}`, {
                method: mode === "create" ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: owner.scope, targetId: owner.id, name, description, permissions }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Could not save the role")
                return
            }
            toast.success(mode === "create" ? "Role created" : "Role saved")
            router.push(backHref)
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    async function remove() {
        if (!role) return
        const ok = await confirm({
            title: `Delete the role "${initial.name}"?`,
            message: "This cannot be undone.",
            confirmLabel: "Delete",
            tone: "danger",
        })
        if (!ok) return
        setBusy("delete")
        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not delete the role", { description: data.error })
                return
            }
            toast.success("Role deleted")
            router.push(backHref)
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    if (!owner) return null
    const modules = roleModules(permissions)
    const everything = permissions.includes("*")

    return (
        <div className="space-y-6">
            <div>
                <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-900">
                    ← All roles
                </Link>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
                    {mode === "create" ? "New role" : readOnly ? initial.name : `Edit ${initial.name}`}
                </h1>
                {readOnly && (
                    <p className="mt-1 text-sm text-zinc-500">You can look at this role but not change it: you cannot change roles here, or it holds access above yours.</p>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div className="space-y-6">
                    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
                        <h2 className="text-sm font-semibold text-zinc-900">Details</h2>
                        {mode === "create" && owners.length > 1 && (
                            <label className="block text-sm font-medium text-zinc-700">
                                Belongs to
                                <select className={`${inputClass} mt-1.5`} value={ownerId} onChange={(e) => chooseOwner(e.target.value)}>
                                    {owners.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.scope === "BUSINESS" ? `Business: ${o.label}` : `Shop: ${o.label}`}
                                        </option>
                                    ))}
                                </select>
                                <span className="mt-1 block text-xs font-normal text-zinc-500">
                                    A business role can be given for the whole business or for one shop. A shop role only works in its own shop.
                                </span>
                            </label>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-zinc-700">
                                Name
                                <input className={`${inputClass} mt-1.5`} value={name} maxLength={60} disabled={readOnly} placeholder="e.g. Stock keeper" onChange={(e) => setName(e.target.value)} />
                            </label>
                            <label className="block text-sm font-medium text-zinc-700">
                                Description (optional)
                                <input className={`${inputClass} mt-1.5`} value={description} maxLength={200} disabled={readOnly} placeholder="What this person does" onChange={(e) => setDescription(e.target.value)} />
                            </label>
                        </div>
                    </section>

                    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">What this role can do</h2>
                            <p className="mt-0.5 text-xs text-zinc-500">
                                Tick a whole module, or open it and pick single actions. You can only give permissions you hold yourself.
                            </p>
                        </div>
                        <PermissionPicker
                            key={owner.id}
                            keys={owner.keys}
                            value={permissions}
                            onChange={setPermissions}
                            grantable={owner.grantable}
                            canEverything={owner.canEverything}
                            readOnly={readOnly}
                        />
                    </section>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-20">
                    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
                        <h2 className="text-sm font-semibold text-zinc-900">Summary</h2>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <dt className="text-zinc-500">Belongs to</dt>
                                <dd className="truncate text-right text-zinc-900">{owner.label}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zinc-500">Level</dt>
                                <dd className="text-zinc-900">{owner.scope === "BUSINESS" ? "Business" : "Shop"}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zinc-500">Access</dt>
                                <dd className="text-right text-zinc-900">{accessLabel(permissions)}</dd>
                            </div>
                            {role && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-zinc-500">In use</dt>
                                    <dd className="text-right text-zinc-900">
                                        {role.members} {role.members === 1 ? "person" : "people"}
                                        {role.invites > 0 ? `, ${role.invites} waiting` : ""}
                                    </dd>
                                </div>
                            )}
                        </dl>
                        {!everything && modules.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                                {modules.map((m) => (
                                    <span key={m} className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700">{m}</span>
                                ))}
                            </div>
                        )}
                        {role && (
                            <Link href={teamHref} className="block text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                                See and change who holds roles on the Team page
                            </Link>
                        )}
                    </div>

                    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                    <div className="space-y-2">
                        {!readOnly && (
                            <button
                                type="button"
                                disabled={busy !== null || !name.trim() || (mode === "edit" && !dirty)}
                                onClick={() => void save()}
                                className="h-10 w-full rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {busy === "save" ? "Saving..." : mode === "create" ? "Create role" : "Save changes"}
                            </button>
                        )}
                        <Link href={backHref} className="flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                            {readOnly ? "Close" : "Cancel"}
                        </Link>
                        {mode === "edit" && (
                            <>
                                <button
                                    type="button"
                                    disabled={busy !== null || !!inUseNote}
                                    onClick={() => void remove()}
                                    className="h-10 w-full rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                    {busy === "delete" ? "Deleting..." : "Delete role"}
                                </button>
                                {inUseNote && <p className="text-xs text-zinc-500">{inUseNote}</p>}
                            </>
                        )}
                        {dirty && !readOnly && <p className="text-center text-xs text-zinc-400">Unsaved changes</p>}
                    </div>
                </aside>
            </div>
        </div>
    )
}
