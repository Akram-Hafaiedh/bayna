import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { auth } from "@/auth"
import { SITE } from "@/lib/shared/site"
import ContactForm from "@/components/contact/ContactForm"
import { INVITE_TTL_DAYS } from "@/lib/access/invite-token"

export const metadata: Metadata = {
    title: "Contact us",
    description: "Send a message to the Bayna team, or find an answer to a common question.",
}

const HELP: { q: string; a: React.ReactNode }[] = [
    {
        q: "I forgot my password",
        a: (
            <>
                Use <Link href="/forgot-password" className="font-medium text-zinc-900 underline underline-offset-2">Forgot password</Link> on the sign-in page and follow the link. A new password ends your other sessions.
            </>
        ),
    },
    {
        q: "I applied for a shop and it is still waiting",
        a: "A new shop is checked by our team before it goes live, and you are notified when it is approved or if we need something. While it waits you can still complete or correct its details from Business, Shops.",
    },
    {
        q: "My invitation link does not work",
        a: `Invitation links work for ${INVITE_TTL_DAYS} days and only for the email address they were sent to. Ask the person who invited you to send a new one, and sign in or sign up with that same address.`,
    },
    {
        q: "My account says it is suspended or closed",
        a: "Write to us from the email address of the account and we will tell you why and what can be done.",
    },
    {
        q: "I found a wrong price, a wrong address or a shop that should not be listed",
        a: "Tell us the name of the shop and the product, and what is wrong. We check it with the shop.",
    },
    {
        q: "I want to see, correct or delete my personal information",
        a: (
            <>
                Write to us from the email address of the account. See the{" "}
                <Link href="/privacy" className="font-medium text-zinc-900 underline underline-offset-2">Privacy policy</Link> for what we hold and your rights.
            </>
        ),
    },
]

async function FormWithDetails() {
    await connection()
    const session = await auth()
    return <ContactForm defaultName={session?.user?.name ?? ""} defaultEmail={session?.user?.email ?? ""} />
}

export default function ContactPage() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-12 text-zinc-900 sm:px-6 sm:py-16">
            <header className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Contact us</h1>
                <p className="mt-4 text-base leading-relaxed text-zinc-700">
                    Send us a message and the team will answer by email. Many questions already have an answer further down.
                </p>
            </header>

            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                <Suspense fallback={<div className="h-[34rem] animate-pulse rounded-2xl bg-zinc-200" />}>
                    <FormWithDetails />
                </Suspense>

                <aside className="space-y-4 text-sm text-zinc-700">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                        <h2 className="text-sm font-semibold text-zinc-900">Before you write</h2>
                        <p className="mt-2 leading-relaxed">Say which shop or product it is about, and write from the email address of your {SITE.name} account if you have one.</p>
                    </div>
                    {SITE.contactEmail && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <h2 className="text-sm font-semibold text-zinc-900">Prefer email?</h2>
                            <a href={`mailto:${SITE.contactEmail}`} className="mt-2 inline-block break-all font-medium text-zinc-900 underline underline-offset-2">{SITE.contactEmail}</a>
                        </div>
                    )}
                    {(SITE.companyName || SITE.companyAddress) && (
                        <p className="px-1 text-xs leading-relaxed text-zinc-500">
                            {SITE.name} is run by {SITE.companyName ?? `the ${SITE.name} team`}
                            {SITE.companyAddress ? `, ${SITE.companyAddress}` : ""}.
                        </p>
                    )}
                </aside>
            </div>

            <section className="mt-10">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Common questions</h2>
                <div className="mt-5 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
                    {HELP.map((item) => (
                        <details key={item.q} className="group px-6 py-4">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-zinc-900">
                                {item.q}
                                <span aria-hidden="true" className="text-xl leading-none text-zinc-400 transition group-open:rotate-45">+</span>
                            </summary>
                            <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
                        </details>
                    ))}
                </div>
            </section>
        </div>
    )
}
