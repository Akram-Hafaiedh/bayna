import { Suspense } from "react"
import Link from "next/link"
import { SITE } from "@/lib/site"

// The year is read inside a cached component, the same way the sign-in layout does it
async function Year() {
    "use cache"
    return <>{new Date().getFullYear()}</>
}

const LINKS = [
    { href: "/plans", label: "Plans" },
    { href: "/contact", label: "Contact and help" },
    { href: "/terms", label: "Terms of use" },
    { href: "/privacy", label: "Privacy policy" },
]

export default function Footer() {
    return (
        <footer className="border-t border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p>
                    &copy;{" "}
                    <Suspense fallback={null}>
                        <Year />
                    </Suspense>{" "}
                    {SITE.name} &middot; Tunisia
                </p>
                <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
                    {LINKS.map((l) => (
                        <Link key={l.href} href={l.href} className="text-zinc-600 transition hover:text-zinc-900">
                            {l.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    )
}
