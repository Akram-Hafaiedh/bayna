// lib/auth-return.ts
// What the sign-in and register pages read from their address: where to go afterwards (`next`, only a
// path inside the site) and an email to fill in (an invitation is for one address). Pure (unit tested).
import { parseEmail } from "@/lib/auth/email-input"
import { safeNextPath } from "@/lib/shared/parse"

export function readAuthReturn(search: string): { next: string | null; email: string | null } {
    const q = new URLSearchParams(search)
    const email = q.get("email")
    const parsed = email ? parseEmail(email) : null
    return { next: safeNextPath(q.get("next")), email: parsed && parsed.ok ? parsed.value : null }
}
