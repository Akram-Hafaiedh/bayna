// app/api/contact/route.ts
// POST: a message from the Contact page. Open to everyone, signed in or not. A hidden field catches robots
// (answered as if it worked, nothing stored) and a sender may only write a few times an hour.
// The team reads the messages in the admin area (Messages).
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { checkRate, parseContactInput } from "@/lib/contact"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null)
        const parsed = parseContactInput(body)
        if (!parsed.ok) {
            // A robot gets the same answer as a person, so it learns nothing
            if ("spam" in parsed) return NextResponse.json({ message: "Thank you, your message was sent." }, { status: 201 })
            return NextResponse.json({ error: parsed.error }, { status: 400 })
        }
        const input = parsed.value

        const meta = requestMeta(req)
        const now = Date.now()
        // The same email or the same address
        const sender = [{ email: input.email }, ...(meta.ip ? [{ ip: meta.ip }] : [])]
        const [lastHour, lastDay] = await Promise.all([
            prisma.contactMessage.count({ where: { OR: sender, createdAt: { gte: new Date(now - HOUR) } } }),
            prisma.contactMessage.count({ where: { OR: sender, createdAt: { gte: new Date(now - DAY) } } }),
        ])
        const rate = checkRate({ lastHour, lastDay })
        if (!rate.ok) return NextResponse.json({ error: rate.error }, { status: 429 })

        const session = await auth()
        const userId = session?.user?.id || null
        const actor = userId ? actorFromSession(session, meta) : actorFromSession(null, meta, { actorName: input.email })

        await withAudit(actor, (tx) =>
            tx.contactMessage.create({
                data: {
                    name: input.name,
                    email: input.email,
                    topic: input.topic,
                    message: input.message,
                    userId,
                    ip: meta.ip ?? null,
                    userAgent: meta.userAgent ?? null,
                },
                select: { id: true },
            })
        )

        return NextResponse.json({ message: "Thank you, your message was sent." }, { status: 201 })
    } catch (error) {
        console.error("Contact message error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
