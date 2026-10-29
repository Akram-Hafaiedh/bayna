// tests/api/setup.ts
// Runs before every API test file. Replaces the real sign-in (@/auth) with a fake one, so a test chooses who
// is signed in with signInAs(email) (see helpers.ts) and everything below it (guards, routes) runs for real.
import { vi } from "vitest"

declare global {
    // eslint-disable-next-line no-var
    var __testSession:
        | {
            user: { id: string; email: string; name: string | null; role: string }
            /** Set by a test to act as a "view as" session (what auth.ts adds for a staff member viewing another account) */
            impersonation?: { id: string; mode: "READ_ONLY" | "WRITE"; expiresAt: string; adminId: string; adminName: string; targetName: string }
        }
        | null
        | undefined
}

vi.mock("@/auth", () => ({
    auth: async () => globalThis.__testSession ?? null,
    handlers: {},
    signIn: async () => undefined,
    signOut: async () => undefined,
}))
