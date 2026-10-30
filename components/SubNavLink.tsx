"use client"
// A sub-navigation link that shows which page you are on.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { isActiveLink } from "@/lib/shared/active-link"

export default function SubNavLink({ href, label }: { href: string; label: string }) {
    const pathname = usePathname()
    const active = isActiveLink(pathname, href)
    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
        >
            {label}
        </Link>
    )
}
