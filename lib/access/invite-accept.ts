// lib/access/invite-accept.ts
// May this signed-in person accept this invitation? The checks of POST /api/invites/accept, kept
// pure so every refusal is unit tested. The route runs them, then claims the invitation atomically.
import { normalizeEmail } from "@/lib/auth/email-input"
import type { InviteState } from "./invite-token"

export type AcceptCheck = { ok: true } | { ok: false; error: string; status: 403 | 410 }

export const ACCEPT_ERRORS = {
    expired: "This invitation has expired. Ask for a new link.",
    revoked: "This invitation was cancelled. Ask for a new link.",
    accepted: "This invitation was already used.",
    account: "Your account cannot accept invitations right now",
    gone: "This shop or business no longer exists",
} as const

export function checkAcceptable(input: {
    state: InviteState
    inviteEmail: string
    userEmail: string
    targetGone: boolean
    accountActive: boolean
}): AcceptCheck {
    if (!input.accountActive) return { ok: false, error: ACCEPT_ERRORS.account, status: 403 }
    if (input.state !== "pending") return { ok: false, error: ACCEPT_ERRORS[input.state], status: 410 }

    const invited = normalizeEmail(input.inviteEmail)
    const signedIn = normalizeEmail(input.userEmail)
    if (invited !== signedIn) {
        return { ok: false, error: `This invitation was sent to ${invited}. You are signed in as ${signedIn}.`, status: 403 }
    }
    if (input.targetGone) return { ok: false, error: ACCEPT_ERRORS.gone, status: 410 }
    return { ok: true }
}
