// lib/access/paging.ts
// "Show more" paging for the team and roles lists. The lists are small and fully loaded, so paging is
// done in the browser: filters and search still look at everyone, only the rows drawn are limited.

export const PAGE_SIZE = 10

/** The rows to draw when `pages` pages are open. */
export function takePage<T>(items: readonly T[], pages: number): T[] {
    return items.slice(0, Math.max(1, pages) * PAGE_SIZE)
}

/** How many more rows the next click reveals (0 when everything is already shown). */
export function nextCount(total: number, pages: number): number {
    return Math.max(0, Math.min(PAGE_SIZE, total - Math.max(1, pages) * PAGE_SIZE))
}
