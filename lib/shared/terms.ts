// lib/terms.ts
// Accepting the Terms and the Privacy policy when an account is created. Pure (unit tested).
import { LEGAL_VERSION } from "./site"

export const ACCEPT_ERROR = "You need to accept the Terms of use and the Privacy policy to create an account"

/** The sign-up must carry an explicit acceptance (the box ticked); the version accepted is the current one. */
export function parseAcceptance(raw: unknown): { ok: true; version: string } | { ok: false; error: string } {
    return raw === true ? { ok: true, version: LEGAL_VERSION } : { ok: false, error: ACCEPT_ERROR }
}
