"use client"
// components/ui/RowMenu.tsx
// The "..." menu of a list row: the less common actions, out of the way. An item is a button
// (onClick) or a link (href). Shared by the team lists and the shops list.
import { useEffect, useRef, useState } from "react"
import Link from "next/link"

export type RowMenuItem = { label: string; onClick?: () => void; href?: string; danger?: boolean }

export default function RowMenu({
    label,
    items,
    disabled,
    buttonLabel,
}: {
    label: string
    items: RowMenuItem[]
    disabled?: boolean
    /** a text button ("Actions" and a chevron) instead of the three dots, for menus in a page header */
    buttonLabel?: string
}) {
    const [open, setOpen] = useState(false)
    // Where the menu sits on screen. It is positioned against the window (not the row), so a table that
    // scrolls sideways or a card with hidden overflow cannot clip it or grow a scrollbar around it.
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
    const box = useRef<HTMLDivElement>(null)
    const button = useRef<HTMLButtonElement>(null)
    function toggle() {
        if (open) return setOpen(false)
        const r = button.current?.getBoundingClientRect()
        if (r) {
            const height = items.length * 36 + 8
            const flip = r.bottom + 4 + height > window.innerHeight && r.top - 4 - height > 0
            setPos({ top: flip ? r.top - 4 - height : r.bottom + 4, right: window.innerWidth - r.right })
        }
        setOpen(true)
    }
    useEffect(() => {
        if (!open) return
        const close = () => setOpen(false)
        window.addEventListener("scroll", close, true)
        window.addEventListener("resize", close)
        const down = (e: MouseEvent) => {
            if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
        }
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", down)
        document.addEventListener("keydown", key)
        return () => {
            window.removeEventListener("scroll", close, true)
            window.removeEventListener("resize", close)
            document.removeEventListener("mousedown", down)
            document.removeEventListener("keydown", key)
        }
    }, [open])
    if (items.length === 0) return null
    return (
        <div ref={box} className="relative">
            <button
                ref={button}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onClick={toggle}
                className={`flex h-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 ${buttonLabel ? "gap-1.5 px-3 text-xs font-medium text-zinc-800" : "w-8"}`}
            >
                {buttonLabel ? (
                    <>
                        {buttonLabel}
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M5 8l5 5 5-5" />
                        </svg>
                    </>
                ) : (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                        <circle cx="4.5" cy="10" r="1.5" />
                        <circle cx="10" cy="10" r="1.5" />
                        <circle cx="15.5" cy="10" r="1.5" />
                    </svg>
                )}
            </button>
            {open && pos && (
                <div
                    role="menu"
                    style={{ position: "fixed", top: pos.top, right: pos.right }}
                    className="z-50 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
                >
                    {items.map((item) => {
                        const cls = `block w-full px-3.5 py-2 text-left text-sm hover:bg-zinc-50 ${item.danger ? "text-red-600" : "text-zinc-800"}`
                        return item.href ? (
                            <Link key={item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)} className={cls}>
                                {item.label}
                            </Link>
                        ) : (
                            <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setOpen(false)
                                    item.onClick?.()
                                }}
                                className={cls}
                            >
                                {item.label}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
