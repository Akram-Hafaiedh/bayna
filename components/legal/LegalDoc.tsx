import Link from "next/link"
import { LEGAL_VERSION, SITE, formatLegalDate, missingSiteDetails } from "@/lib/site"
import type { LegalSection } from "@/lib/legal"

// One legal document (Terms or Privacy): title, date, a contents list on wide screens, then the sections.
// Text colours are set on purpose: the app's default text turns light in dark mode and these cards are white.
export default function LegalDoc({
    title,
    intro,
    sections,
    other,
}: {
    title: string
    intro: string
    sections: LegalSection[]
    other: { href: string; label: string }
}) {
    // Only the team sees this, and only while building: a reminder of the company details still to fill in
    const missing = process.env.NODE_ENV !== "production" ? missingSiteDetails() : []

    return (
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 text-zinc-900">
            {missing.length > 0 && (
                <p className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Draft for the team: set {missing.join(", ")} before launch, and have a lawyer read this page. This note is not shown in production.
                </p>
            )}
            <header className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{title}</h1>
                <p className="mt-3 text-sm text-zinc-500">Last updated {formatLegalDate(LEGAL_VERSION)}</p>
                <p className="mt-5 text-base leading-relaxed text-zinc-700">{intro}</p>
            </header>

            <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
                <nav aria-label="Contents" className="hidden lg:block">
                    <ol className="sticky top-24 space-y-2 text-sm">
                        {sections.map((s, i) => (
                            <li key={s.id}>
                                <a href={`#${s.id}`} className="text-zinc-500 transition hover:text-zinc-900">
                                    <span className="mr-2 tabular-nums text-zinc-400">{i + 1}.</span>
                                    {s.title}
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <article className="space-y-10 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-9">
                    {sections.map((s, i) => (
                        <section key={s.id} id={s.id} className="scroll-mt-24">
                            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                                <span className="mr-2 tabular-nums text-zinc-400">{i + 1}.</span>
                                {s.title}
                            </h2>
                            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-zinc-700">
                                {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                                {s.list && (
                                    <ul className="list-disc space-y-2 pl-5 marker:text-zinc-400">
                                        {s.list.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                )}
                                {s.after?.map((p) => <p key={p}>{p}</p>)}
                            </div>
                        </section>
                    ))}
                    <p className="border-t border-zinc-100 pt-6 text-sm text-zinc-600">
                        Read also: <Link href={other.href} className="font-medium text-zinc-900 underline underline-offset-2">{other.label}</Link>.
                        {" "}Questions? <Link href="/contact" className="font-medium text-zinc-900 underline underline-offset-2">Contact {SITE.name}</Link>.
                    </p>
                </article>
            </div>
        </div>
    )
}
