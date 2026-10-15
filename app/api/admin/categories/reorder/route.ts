// app/api/admin/categories/reorder/route.ts
// POST { ids: string[] }  new display order for categories that share the same parent.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePlatform } from "@/lib/access/guard"
import { withAudit } from "@/lib/audit/run"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
    try {
        const guard = await requirePlatform("catalog.category.reorder", req)
        if (!guard.ok) return bad(guard.error, guard.status)

        const body = await req.json().catch(() => ({}))
        const ids: unknown = body.ids
        if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i  !== "string")) {
            return bad("ids must be a list of category ids")
        }
        if (new Set(ids).size !== ids.length) return bad("ids must be unique")

        const rows = await prisma.category.findMany({
            where: { id: { in: ids as string[] } },
            select: { id: true, parentId: true },
        })
        if (rows.length !== ids.length) return bad("Category not found", 404)
        if (new Set(rows.map((r) => r.parentId)).size > 1) {
            return bad("Only categories with the same parent can be reordered together")
        }

        await withAudit(guard.actor, async (tx) => {
            for (const [index, id] of (ids as string[]).entries()) {
                await tx.category.update({ where: { id }, data: { sortOrder: index + 1 } })
            }
        })
        return NextResponse.json({ message: "Order saved" })
    } catch (error) {
        console.error("Reorder categories error:", error)
        return bad("Something went wrong", 500)
    }
}
