"use client"
// components/ui/Modal.tsx
// A dialog for a small form (the browser's own <dialog>: focus stays inside, Escape closes it).
// ConfirmDialog is for yes / no questions; this is for anything with fields.
//   {open && <Modal title="Add warehouse" onClose={() => setOpen(false)}>...</Modal>}
import { useEffect, useRef } from "react"

export default function Modal({
    title,
    description,
    onClose,
    children,
}: {
    title: string
    description?: string
    onClose: () => void
    children: React.ReactNode
}) {
    const ref = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        const d = ref.current
        if (d && !d.open) d.showModal()
    }, [])
    return (
        <dialog
            ref={ref}
            onClose={onClose}
            onClick={(e) => {
                if (e.target === ref.current) ref.current?.close() // a click on the backdrop
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-900/40"
        >
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
                        {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={() => ref.current?.close()}
                        aria-label="Close"
                        className="-m-1 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                </div>
                <div className="mt-4">{children}</div>
            </div>
        </dialog>
    )
}
