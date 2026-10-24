"use client"
// The shop's modules as icons next to the logo. The name shows as a tooltip under the icon, and the
// icon turns green while you are inside that module. "Soon" modules are visible so the layout is
// final, and open a simple placeholder page.
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { isActiveLink } from "@/lib/active-link"
import { lastShopPath, shopPath } from "@/lib/shop-paths"
import type { ReactNode } from "react"

type Module = { /** section of the shop, for example "team" */ href: string; label: string; soon?: boolean; icon: ReactNode }

const svg = (children: ReactNode) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
)

export const SHOP_MODULES: Module[] = [
    { href: "projects", label: "Projects", soon: true, icon: svg(<><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="6" rx="1.5" /></>) },
    { href: "statistics", label: "Statistics", soon: true, icon: svg(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>) },
    { href: "team", label: "Team", icon: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M18 14.4c1.9.9 3 2.8 3 5.6" /></>) },
    { href: "activity", label: "Activity", icon: svg(<><path d="M3 12h4l3-8 4 16 3-8h4" /></>) },
    { href: "taxes", label: "Taxes", soon: true, icon: svg(<><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></>) },
    { href: "banks", label: "Banks", soon: true, icon: svg(<><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" /></>) },
    { href: "profile", label: "Shop profile", icon: svg(<><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5 12.5V20h14v-7.5" /><path d="M10 20v-4.5h4V20" /></>) },
]

export default function ModuleNav() {
    const pathname = usePathname()
    const params = useParams<{ publicId?: string }>()
    const publicId = typeof params?.publicId === "string" ? params.publicId : null
    return (
        <nav aria-label="Shop modules" className="flex items-center gap-0.5">
            {SHOP_MODULES.map((m) => {
                // Inside a shop the icons stay in that shop; elsewhere they open the shop you used last
                const href = publicId ? shopPath(publicId, m.href) : lastShopPath(m.href)
                const active = publicId ? isActiveLink(pathname, href) : false
                return (
                    <Link
                        key={m.href}
                        href={href}
                        aria-label={m.soon ? `${m.label} (soon)` : m.label}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${active ? "bg-emerald-50 text-emerald-600" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                            }`}
                    >
                        {m.icon}
                        <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                        >
                            {m.label}
                            {m.soon && <span className="ml-1.5 text-zinc-400">Soon</span>}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
