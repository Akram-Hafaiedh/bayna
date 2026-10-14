"use client"

import { useState } from "react"
import { inputClass, useAdminCategories, type AdminCategory } from "@/components/admin/catalog-shared"

type Draft = { name: string; nameAr: string; description: string; parentId: string }

function Row({
    c,
    siblings,
    index,
    kidCount,
    open,
    onMove,
    onAddChild,
    onToggleEdit,
}: {
    c: AdminCategory
    siblings: AdminCategory[]
    index: number
    kidCount: number
    open: boolean
    onMove: (siblings: AdminCategory[], index: number, dir: -1 | 1) => void
    onAddChild: () => void
    onToggleEdit: () => void
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
                <p className="font-medium text-zinc-900">
                    {c.name}
                    {c.nameAr && (
                        <span className="ml-2 text-sm font-normal text-zinc-400" dir="rtl">
                            {c.nameAr}
                        </span>
                    )}
                </p>
                <p className="text-xs text-zinc-400">
                    {c.itemCount} catalogue {c.itemCount === 1 ? "item" : "items"} · {c.productCount}{" "}
                    {c.productCount === 1 ? "product" : "products"}
                    {kidCount > 0 && ` · ${kidCount} sub-categories`}
                </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
                <button
                    type="button"
                    aria-label={`Move ${c.name} up`}
                    disabled={index === 0}
                    onClick={() => onMove(siblings, index, -1)}
                    className="h-7 w-7 rounded-md border border-zinc-200 text-zinc-600 hover:border-zinc-400 disabled:opacity-30"
                >
                    ↑
                </button>
                <button
                    type="button"
                    aria-label={`Move ${c.name} down`}
                    disabled={index === siblings.length - 1}
                    onClick={() => onMove(siblings, index, 1)}
                    className="h-7 w-7 rounded-md border border-zinc-200 text-zinc-600 hover:border-zinc-400 disabled:opacity-30"
                >
                    ↓
                </button>
                {!c.parentId && (
                    <button type="button" onClick={onAddChild} className="text-zinc-700 hover:underline">
                        Add sub-category
                    </button>
                )}
                <button
                    type="button"
                    onClick={onToggleEdit}
                    className="text-zinc-700 hover:underline"
                >
                    {open ? "Close" : "Edit"}
                </button>
            </div>
        </div>
    )
}


function Editor({
    id,
    parentId,
    initial,
    roots,
    hasKids,
    onSave,
    onCancel,
}: {
    id: string | null
    parentId: string
    initial: Draft
    roots: AdminCategory[]
    hasKids: boolean
    onSave: (id: string | null, d: Draft) => Promise<string | null>
    onCancel: () => void
}) {
    const [d, setD] = useState<Draft>({ ...initial, parentId })
    const [err, setErr] = useState("")
    const [busy, setBusy] = useState(false)
    return (
        <form
            onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                setErr("")
                const r = await onSave(id, d)
                if (r) setErr(r)
                setBusy(false)
            }}
            className="space-y-3 rounded-lg bg-zinc-50 p-4 m-3"
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                    <span className="block text-xs font-medium text-zinc-600">Name *</span>
                    <input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={inputClass} />
                </label>
                <label className="block space-y-1">
                    <span className="block text-xs font-medium text-zinc-600">Name (Arabic)</span>
                    <input dir="rtl" value={d.nameAr} onChange={(e) => setD({ ...d, nameAr: e.target.value })} className={inputClass} />
                </label>
                <label className="block space-y-1">
                    <span className="block text-xs font-medium text-zinc-600">Parent</span>
                    <select
                        value={d.parentId}
                        disabled={hasKids}
                        onChange={(e) => setD({ ...d, parentId: e.target.value })}
                        className={inputClass}
                    >
                        <option value="">None (top level)</option>
                        {roots
                            .filter((r) => r.id !== id)
                            .map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                    </select>
                    {hasKids && <span className="block text-xs text-zinc-400">Has sub-categories, so it stays top level.</span>}
                </label>
                <label className="block space-y-1">
                    <span className="block text-xs font-medium text-zinc-600">Description</span>
                    <input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} className={inputClass} />
                </label>
            </div>
            {err && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2 text-sm text-red-600">
                    {err}
                </div>
            )}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={busy}
                    className="h-9 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                    {busy ? "Saving..." : id ? "Save changes" : "Add category"}
                </button>
                <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-900">
                    Cancel
                </button>
            </div>
        </form>
    )
}

export default function AdminCategoriesPage() {
    const { categories, error: loadError, reload } = useAdminCategories()
    // "new:<parentId or empty>" for a new category, or the id of the one being edited
    const [editing, setEditing] = useState<string | null>(null)
    const [error, setError] = useState("")

    const roots = categories.filter((c) => !c.parentId)
    const childrenOf = (id: string) => categories.filter((c) => c.parentId === id)

    async function move(siblings: AdminCategory[], index: number, dir: -1 | 1) {
        const next = [...siblings]
        const j = index + dir
        if (j < 0 || j >= next.length) return
            ;[next[index], next[j]] = [next[j], next[index]]
        setError("")
        const res = await fetch("/api/admin/categories/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: next.map((c) => c.id) }),
        })
        if (!res.ok) {
            const data = await res.json()
            setError(data.error || "Failed to reorder")
            return
        }
        await reload()
    }

    async function save(id: string | null, d: Draft): Promise<string | null> {
        const res = await fetch(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
            method: id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...d, parentId: d.parentId || null }),
        })
        const data = await res.json()
        if (!res.ok) return data.error || "Failed to save"
        setEditing(null)
        await reload()
        return null
    }

    const toDraft = (c: AdminCategory): Draft => ({
        name: c.name,
        nameAr: c.nameAr ?? "",
        description: c.description ?? "",
        parentId: c.parentId ?? "",
    })
    const blank: Draft = { name: "", nameAr: "", description: "", parentId: "" }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Categories</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Top-level categories and one level of sub-categories. Use the arrows to set the display order.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setEditing("new:")}
                    className="h-10 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 self-start"
                >
                    Add category
                </button>
            </div>

            {(error || loadError) && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                    {error || loadError}
                </div>
            )}

            {editing === "new:" && (
                <div className="rounded-xl border border-zinc-200 bg-white">
                    <Editor id={null} parentId="" initial={blank} roots={roots} hasKids={false} onSave={save} onCancel={() => setEditing(null)} />
                </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200 overflow-hidden">
                {roots.length === 0 && <p className="p-8 text-center text-sm text-zinc-500">No categories yet.</p>}
                {roots.map((root, ri) => {
                    const kids = childrenOf(root.id)
                    return (
                        <div key={root.id}>
                            <Row c={root} siblings={roots} index={ri} kidCount={kids.length} open={editing === root.id} onMove={move} onAddChild={() => setEditing(`new:${root.id}`)} onToggleEdit={() => setEditing(editing === root.id ? null : root.id)} />
                            {editing === root.id && <Editor id={root.id} parentId={root.parentId ?? ""} initial={toDraft(root)} roots={roots} hasKids={kids.length > 0} onSave={save} onCancel={() => setEditing(null)} />}
                            {editing === `new:${root.id}` && <Editor id={null} parentId={root.id} initial={blank} roots={roots} hasKids={false} onSave={save} onCancel={() => setEditing(null)} />}
                            {kids.length > 0 && (
                                <div className="ml-6 border-l border-zinc-100 divide-y divide-zinc-100">
                                    {kids.map((k, ki) => (
                                        <div key={k.id}>
                                            <Row c={k} siblings={kids} index={ki} kidCount={0} open={editing === k.id} onMove={move} onAddChild={() => { }} onToggleEdit={() => setEditing(editing === k.id ? null : k.id)} />
                                            {editing === k.id && <Editor id={k.id} parentId={k.parentId ?? ""} initial={toDraft(k)} roots={roots} hasKids={false} onSave={save} onCancel={() => setEditing(null)} />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
