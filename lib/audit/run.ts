// lib/audit/run.ts
// Tell the database who is acting, once per transaction. The audit triggers (migration
// *_audit_triggers) read it to fill createdById / updatedById and to write ActivityLog rows.
//
//   await withAudit(actor, async (tx) => {
//       await tx.product.update({ where: { id }, data: { price } })
//   })
//
// Writes made outside withAudit are still stamped and logged, but with no actor and source SYSTEM.
// Do not set createdAt, updatedAt, createdById or updatedById yourself: the triggers overwrite them.
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { serializeActor, type AuditActor } from "./actor"
import { READ_ONLY_MESSAGE } from "@/lib/admin/impersonation"

export type Tx = Prisma.TransactionClient

/** Thrown when something tries to write during a read-only "view as" session. */
export class ReadOnlyViewError extends Error {
    constructor() {
        super(READ_ONLY_MESSAGE)
        this.name = "ReadOnlyViewError"
    }
}

export async function withAudit<T>(
    actor: AuditActor,
    fn: (tx: Tx) => Promise<T>
): Promise<T> {
    // Every write goes through here, so this is the last line of defence behind the proxy and the guards
    if (actor.readOnly) throw new ReadOnlyViewError()
    return prisma.$transaction(async (tx) => {
        // `true` scopes the setting to this transaction, so it cannot leak to other requests
        // that reuse the same pooled connection.
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(actor)}, true)`
        return fn(tx)
    })
}

export type ActivityEntry = {
    entityType: string
    entityId?: string | null
    /** Set for shop-scoped events so they show up in the shop activity feed. */
    shopId?: string | null
    /** For example LOGIN, PASSWORD_RESET_REQUESTED, IMPERSONATION_START, ROLE_CHANGE. */
    action: string
    changes?: Prisma.InputJsonValue
    note?: string | null
}

/**
 * Record an event that is not a row change (the triggers already cover row changes). Pass the
 * transaction client from withAudit to write it atomically with the change it describes.
 */
export async function logActivity(
    client: Tx | typeof prisma,
    actor: AuditActor,
    entry: ActivityEntry
) {
    return client.activityLog.create({
        data: {
            entityType: entry.entityType,
            entityId: entry.entityId ?? null,
            shopId: entry.shopId ?? null,
            action: entry.action,
            changes: entry.changes,
            note: entry.note ?? null,
            actorId: actor.actorId ?? null,
            actorName: actor.actorName ?? null,
            actorRole: actor.actorRole ?? null,
            onBehalfOfId: actor.onBehalfOfId ?? null,
            impersonationId: actor.impersonationId ?? null,
            source: actor.source ?? "SYSTEM",
            requestId: actor.requestId ?? null,
            ip: actor.ip ?? null,
            userAgent: actor.userAgent ?? null,
        },
    })
}
