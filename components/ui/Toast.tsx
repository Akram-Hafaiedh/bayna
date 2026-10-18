"use client"
// components/ui/Toast.tsx
// Small messages that confirm what just happened ("Price updated"), with an optional button (Undo).
//   const toast = useToast()
//   toast.success("Product removed", { description: "...", action: { label: "Undo", onClick } })
//   toast.error("Could not save")
// Use a toast for the RESULT of an action. Use useConfirm() to ASK before one.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { pushToast, removeToast, toastDuration, type ToastItem, type ToastTone } from "@/lib/toast"

type Options = { description?: string; action?: ToastItem["action"]; duration?: number }
type Api = {
    success: (title: string, options?: Options) => void
    error: (title: string, options?: Options) => void
    info: (title: string, options?: Options) => void
}

const noop = () => { }
const ToastContext = createContext<Api>({ success: noop, error: noop, info: noop })

export function useToast(): Api {
    return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([])
    const nextId = useRef(1)

    const dismiss = useCallback((id: number) => setItems((list) => removeToast(list, id)), [])

    const show = useCallback((tone: ToastTone, title: string, options: Options = {}) => {
        const item: ToastItem = {
            id: nextId.current++,
            tone,
            title,
            description: options.description,
            action: options.action,
            duration: options.duration ?? toastDuration(tone, !!options.action),
        }
        setItems((list) => pushToast(list, item))
    }, [])

    const api = useMemo<Api>(
        () => ({
            success: (title, options) => show("success", title, options),
            error: (title, options) => show("error", title, options),
            info: (title, options) => show("info", title, options),
        }),
        [show]
    )

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div
                role="region"
                aria-label="Notifications"
                className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
            >
                {items.map((item) => (
                    <ToastCard key={item.id} item={item} dismiss={dismiss} />
                ))}
            </div>
        </ToastContext.Provider>
    )
}

const ICON: Record<ToastTone, { path: string; ring: string }> = {
    success: { path: "M5 13l4 4L19 7", ring: "bg-white/10 text-white" },
    error: { path: "M12 8v5m0 3h.01", ring: "bg-red-500/15 text-red-400" },
    info: { path: "M12 11v5m0-8h.01", ring: "bg-white/10 text-white" },
}

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
    const [paused, setPaused] = useState(false)
    const remaining = useRef(item.duration)
    const icon = ICON[item.tone]

    // The timer stops while the pointer or keyboard focus is on the toast, so a button can be reached.
    useEffect(() => {
        if (paused || item.duration <= 0) return
        const startedAt = Date.now()
        const timer = setTimeout(() => dismiss(item.id), remaining.current)
        return () => {
            clearTimeout(timer)
            remaining.current -= Date.now() - startedAt
        }
    }, [paused, item.id, item.duration, dismiss])

    async function runAction() {
        dismiss(item.id)
        await item.action?.onClick()
    }

    return (
        <div
            role={item.tone === "error" ? "alert" : "status"}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-zinc-900 p-3.5 text-sm text-white shadow-lg ring-1 ring-white/10"
        >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${icon.ring}`}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={icon.path} />
                </svg>
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-medium leading-5">{item.title}</p>
                {item.description && <p className="mt-0.5 text-zinc-400">{item.description}</p>}
            </div>
            {item.action && (
                <button
                    type="button"
                    onClick={runAction}
                    className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-white underline-offset-2 hover:bg-white/10 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                    {item.action.label}
                </button>
            )}
            <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
                className="-mr-1 shrink-0 rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                </svg>
            </button>
        </div>
    )
}
