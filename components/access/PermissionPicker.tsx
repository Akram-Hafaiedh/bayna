"use client"
// components/access/PermissionPicker.tsx
// Ticks permissions for a role, grouped as module > resource > action. A switch on a module or a
// resource ticks everything inside it (a half-ticked one shows as partial). "Everything" stores the
// wildcard, which also covers permissions added later. Keys the person does not hold themselves
// cannot be ticked: nobody gives what they do not have (the server checks this again).
import { useMemo, useState } from "react"
import { groupPermissions } from "@/lib/access/role-view"
import { actionTitle, describeKey, moduleTitle, resourceTitle } from "@/lib/access/permission-labels"

type Props = {
    /** every permission key that can be chosen at this level */
    keys: string[]
    value: string[]
    onChange: (next: string[]) => void
    /** the keys this person holds and may therefore hand out */
    grantable: string[]
    /** this person holds "everything", so they may hand it out */
    canEverything: boolean
    readOnly?: boolean
}

function Box({ checked, partial, disabled, onChange, label, title }: {
    checked: boolean
    partial?: boolean
    disabled?: boolean
    onChange: (on: boolean) => void
    label: string
    title?: string
}) {
    return (
        <input
            type="checkbox"
            aria-label={label}
            title={title}
            checked={checked}
            disabled={disabled}
            ref={(el) => { if (el) el.indeterminate = !!partial && !checked }}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        />
    )
}

export default function PermissionPicker({ keys, value, onChange, grantable, canEverything, readOnly }: Props) {
    const selected = useMemo(() => new Set(value), [value])
    const may = useMemo(() => new Set(grantable), [grantable])
    const groups = useMemo(() => groupPermissions(keys), [keys])
    const everything = selected.has("*")
    const [open, setOpen] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(groupPermissions(keys).map((g) => [g.module, g.items.some((i) => i.actions.some((a) => value.includes(`${g.module}.${i.resource}.${a}`)))]))
    )

    const locked = !!readOnly

    function setKeys(list: string[], on: boolean) {
        const next = new Set(selected)
        for (const k of list) {
            if (!may.has(k)) continue
            if (on) next.add(k)
            else next.delete(k)
        }
        onChange([...next])
    }

    const state = (list: string[]) => {
        const n = list.filter((k) => selected.has(k)).length
        return { checked: n === list.length && n > 0, partial: n > 0 && n < list.length, n }
    }
    const canTick = (list: string[]) => !locked && list.some((k) => may.has(k))

    return (
        <div className="space-y-2">
            <label className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${everything ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                <Box
                    checked={everything}
                    disabled={locked || !canEverything}
                    onChange={(on) => onChange(on ? ["*"] : [])}
                    label="Everything"
                    title={canEverything ? undefined : "You do not hold everything yourself"}
                />
                <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900">Everything</span>
                    <span className="block text-xs text-zinc-500">Every permission, including ones added later. Use it for owners.</span>
                </span>
            </label>

            {!everything &&
                groups.map((g) => {
                    const all = g.items.flatMap((i) => i.actions.map((a) => `${g.module}.${i.resource}.${a}`))
                    const m = state(all)
                    const isOpen = open[g.module]
                    return (
                        <div key={g.module} className="rounded-lg border border-zinc-200">
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <Box checked={m.checked} partial={m.partial} disabled={!canTick(all)} onChange={(on) => setKeys(all, on)} label={`All of ${moduleTitle(g.module)}`} />
                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                                    aria-expanded={isOpen}
                                    onClick={() => setOpen((o) => ({ ...o, [g.module]: !o[g.module] }))}
                                >
                                    <span className="text-sm font-medium text-zinc-900">{moduleTitle(g.module)}</span>
                                    <span className="shrink-0 text-xs text-zinc-500">{m.n} of {all.length} {isOpen ? "·  Hide" : "·  Show"}</span>
                                </button>
                            </div>
                            {isOpen && (
                                <ul className="space-y-2.5 border-t border-zinc-100 px-3 py-3">
                                    {g.items.map((i) => {
                                        const list = i.actions.map((a) => `${g.module}.${i.resource}.${a}`)
                                        const r = state(list)
                                        return (
                                            <li key={i.resource} className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
                                                <label className="flex w-44 shrink-0 items-center gap-2 text-sm text-zinc-900">
                                                    <Box checked={r.checked} partial={r.partial} disabled={!canTick(list)} onChange={(on) => setKeys(list, on)} label={`All of ${resourceTitle(i.resource)}`} />
                                                    {resourceTitle(i.resource)}
                                                </label>
                                                <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1.5">
                                                    {i.actions.map((a) => {
                                                        const key = `${g.module}.${i.resource}.${a}`
                                                        const allowed = may.has(key)
                                                        return (
                                                            <label key={key} title={allowed ? describeKey(key) : "You do not hold this permission yourself"} className={`flex items-center gap-1.5 text-xs ${allowed ? "text-zinc-700" : "text-zinc-400"}`}>
                                                                <Box checked={selected.has(key)} disabled={locked || !allowed} onChange={(on) => setKeys([key], on)} label={describeKey(key)} />
                                                                {actionTitle(a)}
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    )
                })}
        </div>
    )
}
