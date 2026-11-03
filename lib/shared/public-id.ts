// The id people and browsers see for a product, warehouse or tax. The database `id` stays internal:
// it never appears in a link, a page, an API response or a request. Made by the database (16 hex characters).
export const PUBLIC_ID_RE = /^[0-9a-f]{16}$/

export function isPublicId(value: unknown): value is string {
    return typeof value === "string" && PUBLIC_ID_RE.test(value)
}

// Keeps only well-formed public ids, so a bad value never reaches a query
export function publicIds(values: unknown): string[] {
    return Array.isArray(values) ? values.filter(isPublicId) : []
}
