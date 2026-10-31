// lib/shared/toast.ts
// The pure part of the toast system (queue rules and timing). The UI lives in components/ui/Toast.tsx.

export type ToastTone = "success" | "error" | "info"

export type ToastItem = {
    id: number
    tone: ToastTone
    title: string
    description?: string
    action?: { label: string; onClick: () => void | Promise<void> }
    /** Milliseconds before it closes itself. 0 = stays until closed. */
    duration: number
}

export const MAX_TOASTS = 4

/** How long a toast stays. Errors stay longest, and anything with a button gets time to be used. */
export function toastDuration(tone: ToastTone, hasAction: boolean): number {
    if (tone === "error") return 8000
    if (hasAction) return 8000
    return tone === "success" ? 4000 : 5000
}

/** Adds a toast, newest last. When there are too many the oldest ones are dropped. */
export function pushToast(list: ToastItem[], next: ToastItem, max = MAX_TOASTS): ToastItem[] {
    const out = [...list, next]
    return out.length > max ? out.slice(out.length - max) : out
}

export function removeToast(list: ToastItem[], id: number): ToastItem[] {
    return list.filter((t) => t.id !== id)
}
