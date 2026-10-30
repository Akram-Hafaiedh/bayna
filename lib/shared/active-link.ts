// lib/shared/active-link.ts
// Is this link the one the current page belongs to? Used by the shop module icons and the sub-navs.
export function isActiveLink(pathname: string | null | undefined, href: string): boolean {
    if (!pathname) return false
    return pathname === href || pathname.startsWith(href + "/")
}
