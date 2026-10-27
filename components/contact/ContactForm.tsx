"use client"

// The form on the Contact page. A hidden field ("website") catches robots; people never see or fill it.
import { useState } from "react"
import { CONTACT_TOPICS, MESSAGE_MAX, type ContactTopicValue } from "@/lib/contact"

const field =
    "w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"

export default function ContactForm({ defaultName = "", defaultEmail = "" }: { defaultName?: string; defaultEmail?: string }) {
    const [name, setName] = useState(defaultName)
    const [email, setEmail] = useState(defaultEmail)
    const [topic, setTopic] = useState<ContactTopicValue | "">("")
    const [message, setMessage] = useState("")
    const [website, setWebsite] = useState("") // the trap
    const [error, setError] = useState("")
    const [sending, setSending] = useState(false)
    const [sentTo, setSentTo] = useState<string | null>(null)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        setSending(true)
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, topic, message, website }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Your message could not be sent. Please try again.")
                return
            }
            setSentTo(email)
            setMessage("")
            setTopic("")
        } catch {
            setError("Your message could not be sent. Please check your connection and try again.")
        } finally {
            setSending(false)
        }
    }

    if (sentTo) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">&#10003;</div>
                <h2 className="mt-4 text-xl font-semibold text-emerald-900">Message sent</h2>
                <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                    Thank you. We will answer at <span className="font-medium">{sentTo}</span> as soon as we can.
                </p>
                <button
                    type="button"
                    onClick={() => setSentTo(null)}
                    className="mt-6 inline-flex h-10 items-center rounded-lg border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
                >
                    Write another message
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 sm:p-8" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor="c-name" className="block text-sm font-medium text-zinc-700">Your name</label>
                    <input id="c-name" type="text" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={`${field} h-11`} />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="c-email" className="block text-sm font-medium text-zinc-700">Email</label>
                    <input id="c-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`${field} h-11`} />
                </div>
            </div>

            <div className="space-y-1.5">
                <label htmlFor="c-topic" className="block text-sm font-medium text-zinc-700">What is it about?</label>
                <select id="c-topic" required value={topic} onChange={(e) => setTopic(e.target.value as ContactTopicValue)} className={`${field} h-11`}>
                    <option value="" disabled>Choose a topic</option>
                    {CONTACT_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>

            <div className="space-y-1.5">
                <label htmlFor="c-message" className="block text-sm font-medium text-zinc-700">Your message</label>
                <textarea
                    id="c-message"
                    required
                    rows={7}
                    maxLength={MESSAGE_MAX}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what happened. For a shop or a price, include the shop and product name."
                    className={`${field} resize-y py-3 leading-relaxed`}
                />
                <p className="text-right text-xs tabular-nums text-zinc-400">{message.length} / {MESSAGE_MAX}</p>
            </div>

            {/* The trap: off-screen, not tabbable, hidden from screen readers */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="c-website">Leave this empty</label>
                <input id="c-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}

            <button
                type="submit"
                disabled={sending}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-5 text-[15px] font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
                {sending ? "Sending..." : "Send message"}
            </button>
            <p className="text-xs leading-relaxed text-zinc-500">We use your details only to answer you. See the Privacy policy.</p>
        </form>
    )
}
