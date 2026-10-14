// app/api/admin/suggestions/route.ts
// GET /api/admin/suggestions?status=pending|approved|rejected|all
// Catalogue requests from providers, each with possible duplicates already in the catalogue.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { isAdmin } from "@/lib/admin-auth"

const STATUSES = { pending: "PENDING", approved: "APPROVED", rejected: "REJECTED" } as const

export async function GET(req: Request) {
    try {
        if (!(await isAdmin())) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const status = new URL(req.url).searchParams.get("status") ?? "pending"
        const where: Prisma.CatalogSuggestionWhereInput =
            status in STATUSES ? { status: STATUSES[status as keyof typeof STATUSES] } : {}

        const rows = await prisma.catalogSuggestion.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: 100,
            include: {
                provider: { select: { businessName: true, city: true } },
                category: { select: { id: true, name: true } },
                catalogItem: { select: { id: true, name: true } },
            },
        })

        // Possible duplicates: same category, name shares a word with the request
        const suggestions = await Promise.all(
            rows.map(async (r) => {
                let similar: { id: string; name: string; brand: string | null; unit: string }[] = []
                if (r.status === "PENDING") {
                    const words = r.name.split(/\s+/).filter((w) => w.length > 2).slice(0, 4)
                    if (words.length > 0) {
                        similar = await prisma.catalogItem.findMany({
                            where: {
                                isActive: true,
                                categoryId: r.categoryId,
                                OR: words.map((w) => ({
                                    name: { contains: w, mode: "insensitive" as const },
                                })),
                            },
                            select: { id: true, name: true, brand: true, unit: true },
                            orderBy: { name: "asc" },
                            take: 6,
                        })
                    }
                }
                return { ...r, similar }
            })
        )

        return NextResponse.json({ suggestions })
    } catch (error) {
        console.error("List suggestions error:", error)
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
}
