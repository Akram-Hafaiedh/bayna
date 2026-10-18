// app/api/provider/apply/route.ts
// The shop application. POST submits it, GET shows its status, PATCH edits it while it is pending,
// DELETE withdraws it. A person may run several shops, so a provider can apply again for another one
// (one application at a time). The fields are checked by the same parser as the shop profile.
// The role stays CLIENT until an admin approves.
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { withAudit } from "@/lib/audit/run"
import { actorFromSession, requestMeta } from "@/lib/audit/actor"
import { Role } from "@/app/generated/prisma/enums"
import { parsePhone, parseProfileFields } from "@/lib/provider-input"

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const failed = () => NextResponse.json({ error: "Something went wrong" }, { status: 500 })

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return unauthorized()
        const userId = session.user.id

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

        if (user.role === Role.ADMIN) {
            return NextResponse.json({ error: "Admin accounts cannot become providers" }, { status: 400 })
        }
        const waiting = await prisma.provider.findFirst({
            where: { userId, isVerified: false, deletedAt: null },
            select: { id: true },
        })
        if (waiting) {
            return NextResponse.json({ error: "You already have an application waiting for approval" }, { status: 400 })
        }

        const body = await req.json().catch(() => null)
        const parsed = parseProfileFields(body, null)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const data = parsed.value.data

        // A shop needs a number customers can call: the one typed here, else the account's own
        if (!data.phone) {
            const own = parsePhone(user.phone, "Phone")
            if (own.ok && own.value) data.phone = own.value
        }
        if (!data.phone) return NextResponse.json({ error: "A phone number is required" }, { status: 400 })

        const provider = await withAudit(actorFromSession(session, requestMeta(req)), (tx) =>
            tx.provider.create({
                data: {
                    userId,
                    businessName: data.businessName!,
                    city: data.city!,
                    governorate: data.governorate!,
                    description: data.description ?? null,
                    phone: data.phone,
                    whatsapp: data.whatsapp ?? null,
                    address: data.address ?? null,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    locationSource: data.locationSource,
                    isVerified: false,
                },
            })
        )

        return NextResponse.json(
            { message: "Application submitted. Waiting for admin approval.", providerId: provider.id, status: "pending" },
            { status: 201 }
        )
    } catch (error) {
        console.error("Become provider error:", error)
        return failed()
    }
}

// GET: the current user's waiting application, if any
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) return unauthorized()

        const provider = await prisma.provider.findFirst({
            where: { userId: session.user.id, isVerified: false, deletedAt: null },
            orderBy: { createdAt: "desc" },
        })
        if (!provider) return NextResponse.json({ status: "none" })

        return NextResponse.json({ status: "pending", provider })
    } catch (error) {
        console.error("Get provider status error:", error)
        return failed()
    }
}

/** The signed-in person's application, only while it is still pending. */
async function pendingApplication() {
    const session = await auth()
    if (!session?.user?.id) return { error: unauthorized() } as const
    const provider = await prisma.provider.findFirst({
        where: { userId: session.user.id, isVerified: false, deletedAt: null },
        orderBy: { createdAt: "desc" },
    })
    if (!provider) return { error: NextResponse.json({ error: "You have no application waiting" }, { status: 404 }) } as const
    return { session, provider } as const
}

// PATCH: edit the application while it waits for approval
export async function PATCH(req: Request) {
    try {
        const found = await pendingApplication()
        if ("error" in found) return found.error
        const { session, provider } = found

        const body = await req.json().catch(() => null)
        const parsed = parseProfileFields(body, provider)
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
        if (parsed.value.data.phone === null) {
            return NextResponse.json({ error: "A phone number is required" }, { status: 400 })
        }

        const updated = await withAudit(actorFromSession(session, requestMeta(req)), (tx) =>
            tx.provider.update({ where: { id: provider.id }, data: parsed.value.data })
        )
        return NextResponse.json({ message: "Application updated", status: "pending", provider: updated })
    } catch (error) {
        console.error("Update application error:", error)
        return failed()
    }
}

// DELETE: withdraw the application
export async function DELETE(req: Request) {
    try {
        const found = await pendingApplication()
        if ("error" in found) return found.error
        const { session, provider } = found

        await withAudit(actorFromSession(session, requestMeta(req)), (tx) =>
            tx.provider.delete({ where: { id: provider.id } })
        )
        return NextResponse.json({ message: "Application withdrawn" })
    } catch (error) {
        console.error("Withdraw application error:", error)
        return failed()
    }
}
