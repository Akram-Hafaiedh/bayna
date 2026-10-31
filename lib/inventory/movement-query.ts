// lib/inventory/movement-query.ts
// The filters of the stock history, read from the query string. Pure (unit tested).
import { isMovementType, type MovementType } from "@/lib/inventory/stock-rules"
import { isReasonCode, type ReasonCode } from "@/lib/inventory/stock-reasons"

export const MOVEMENT_PAGE_SIZE = 50
export const MOVEMENT_MAX_PAGE_SIZE = 200

export type MovementQuery = {
    warehouseId: string | null
    productId: string | null
    type: MovementType | null
    reasonCode: ReasonCode | null
    /** Inclusive day range, as dates (UTC midnight); `to` is the start of the day after it */
    from: Date | null
    to: Date | null
    page: number
    pageSize: number
}

function day(v: string | null): Date | null {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
    const d = new Date(`${v}T00:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d
}

export function parseMovementQuery(params: URLSearchParams): MovementQuery {
    const type = params.get("type")
    const reason = params.get("reasonCode")
    const from = day(params.get("from"))
    const toDay = day(params.get("to"))
    const page = Number(params.get("page"))
    const size = Number(params.get("pageSize"))
    return {
        warehouseId: params.get("warehouse") || null,
        productId: params.get("product") || null,
        type: isMovementType(type) ? type : null,
        reasonCode: isReasonCode(reason) ? reason : null,
        from,
        to: toDay ? new Date(toDay.getTime() + 24 * 3600 * 1000) : null,
        page: Number.isInteger(page) && page >= 1 ? page : 1,
        pageSize: Number.isInteger(size) && size >= 1 ? Math.min(size, MOVEMENT_MAX_PAGE_SIZE) : MOVEMENT_PAGE_SIZE,
    }
}
