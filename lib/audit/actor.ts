// lib/audit/actor.ts
// Who is acting, in the shape the database audit triggers read from the transaction setting
// `app.audit` (see prisma/migrations/*_audit_triggers). Pure and dependency-free so it can be
// unit-tested without a database.

export type AuditSource = "WEB" | "API" | "SEED" | "JOB" | "IMPORT" | "WEBHOOK" | "SYSTEM"

export type AuditActor = {
    /** The real person acting. During impersonation this is the admin, never the viewed user. */
    actorId: string | null
    /** Copied into ActivityLog so history survives deleting or anonymising the user. */
    actorName?: string | null
    /** Platform role or shop role at the time, for example "ADMIN" or "shop:MANAGER". */
    actorRole?: string | null
    /** The user being impersonated, if any. */
    onBehalfOfId?: string | null
    impersonationId?: string | null
    source?: AuditSource
    requestId?: string | null
    ip?: string | null
    userAgent?: string | null
}

export type RequestMeta = Pick<AuditActor, "requestId" | "ip" | "userAgent">

type SessionLike =
    | {
        user?: {
            id?: string | null
            name?: string | null
            email?: string | null
            role?: string | null
        } | null
    }
    | null
    | undefined

const MAX_LENGTH = 500
const clip = (value: string | null | undefined) =>
    value === null || value === undefined ? null : value.slice(0, MAX_LENGTH)

/** The JSON string stored in `app.audit`. Only known keys are written; text is length-limited. */
export function serializeActor(actor: AuditActor): string {
    return JSON.stringify({
        actorId: actor.actorId ?? null,
        actorName: clip(actor.actorName),
        actorRole: clip(actor.actorRole),
        onBehalfOfId: actor.onBehalfOfId ?? null,
        impersonationId: actor.impersonationId ?? null,
        source: actor.source ?? "SYSTEM",
        requestId: clip(actor.requestId),
        ip: clip(actor.ip),
        userAgent: clip(actor.userAgent),
    })
}

/**
 * Request id, client IP and user agent. The forwarded IP is only trustworthy behind a proxy that
 * sets it (Vercel does); treat it as a hint for the timeline, not as proof of origin.
 */
export function requestMeta(req: Request): RequestMeta {
    const headers = req.headers
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    return {
        requestId: headers.get("x-request-id")?.trim() || globalThis.crypto.randomUUID(),
        ip: forwarded || headers.get("x-real-ip")?.trim() || null,
        userAgent: clip(headers.get("user-agent")),
    }
}

/**
 * Build the actor from a NextAuth session. A missing session, or the empty id that auth.ts puts in
 * the session of a revoked login, becomes an anonymous actor (actorId null).
 */
export function actorFromSession(
    session: SessionLike,
    meta: RequestMeta = {},
    extra: Partial<AuditActor> = {}
): AuditActor {
    const user = session?.user
    return {
        actorId: user?.id || null,
        actorName: user?.name || user?.email || null,
        actorRole: user?.role ?? null,
        source: "WEB",
        ...meta,
        ...extra,
    }
}

/** For seeds, jobs, imports and webhooks: no person, but a labelled source. */
export function systemActor(source: AuditSource = "SYSTEM", name = "System"): AuditActor {
    return { actorId: null, actorName: name, source }
}
