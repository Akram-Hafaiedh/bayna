// lib/shared/time-ago.ts
// "just now", "5 min ago", "3 h ago", "2 d ago", then the date.
export function timeAgo(from: Date | string, now: Date = new Date()): string {
    const then = typeof from === "string" ? new Date(from) : from
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
    if (Number.isNaN(seconds) || seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} d ago`
    return then.toISOString().slice(0, 10)
}
