"use client"
// components/ui/ConfirmDialog.tsx
// Replaces window.confirm(). Ask, then wait for the answer:
//   const confirm = useConfirm()
//   if (!(await confirm({ title: "Remove this product?", message: "...", confirmLabel: "Remove", tone: "danger" }))) return
// Escape, the backdrop and Cancel all answer "no". Focus is kept inside and returned afterwards.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

export type ConfirmOptions = {
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    /** "danger" = the safe choice (Cancel) is focused first and the icon is a bin. The look stays black and white. */
    tone?: "danger" | "default"
}

type Ask = (options: ConfirmOptions) => Promise<boolean>

// Outside the provider it falls back to the browser's own dialog, so nothing silently auto-confirms.
const fallback: Ask = async (o) => (typeof window === "undefined" ? false : window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title))
const ConfirmContext = createContext<Ask>(fallback)

export function useConfirm(): Ask {
    return useContext(ConfirmContext)
}

type Pending = { options: ConfirmOptions; resolve: (answer: boolean) => void }

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<Pending | null>(null)
    const pendingRef = useRef<Pending | null>(null)

    const ask = useCallback<Ask>((options) => {
        return new Promise<boolean>((resolve) => {
            pendingRef.current?.resolve(false) // a second question cancels the first
            const next = { options, resolve }
            pendingRef.current = next
            setPending(next)
        })
    }, [])

    const answer = useCallback((value: boolean) => {
        const current = pendingRef.current
        pendingRef.current = null
        setPending(null)
        current?.resolve(value)
    }, [])

    return (
        <ConfirmContext.Provider value={ask}>
            {children}
            {pending && <Dialog options={pending.options} answer={answer} />}
        </ConfirmContext.Provider>
    )
}

function Dialog({ options, answer }: { options: ConfirmOptions; answer: (value: boolean) => void }) {
    const { title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default" } = options
    const danger = tone === "danger"
    const cancelRef = useRef<HTMLButtonElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const before = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
            ; (danger ? cancelRef : confirmRef).current?.focus()
        return () => {
            document.body.style.overflow = overflow
            before?.focus?.()
        }
    }, [danger])

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault()
            answer(false)
            return
        }
        if (e.key === "Tab") {
            // Two buttons: keep focus cycling between them
            const first = cancelRef.current
            const last = confirmRef.current
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last?.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first?.focus()
            }
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" onKeyDown={onKeyDown}>
            <div className="dialog-fade absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={() => answer(false)} aria-hidden />
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby={message ? "confirm-message" : undefined}
                className="dialog-pop relative w-full max-w-md rounded-2xl bg-white p-6 text-zinc-900 shadow-xl ring-1 ring-zinc-200"
            >
                <div className="flex items-start gap-4">
                    <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900"
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {danger ? (
                                <path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" />
                            ) : (
                                <path d="M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                            )}
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <h2 id="confirm-title" className="text-base font-semibold">
                            {title}
                        </h2>
                        {message && (
                            <p id="confirm-message" className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-600">
                                {message}
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => answer(false)}
                        className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={() => answer(true)}
                        className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
