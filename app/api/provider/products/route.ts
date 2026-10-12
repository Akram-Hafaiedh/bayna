// app/api/provider/products/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

async function getVerifiedProvider() {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== Role.PROVIDER) {
        return { error: "Unauthorized", status: 401 as const }
    }

    const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
    })

    if (!provider) {
        return { error: "Provider profile not found", status: 404 as const }
    }

    if (!provider.isVerified) {
        return { error: "Provider not verified yet", status: 403 as const }
    }

    return { provider, session }
}

export async function GET() {
    try {
        const result = await getVerifiedProvider()
        if ("error" in result && result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }
        const { provider } = result as { provider: { id: string } }

        const products = await prisma.product.findMany({
            where: { providerId: provider.id },
            include: { category: true },
            orderBy: { updatedAt: "desc" },
        })

        return NextResponse.json({ products })
    } catch (error) {
        console.error("List products error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}

export async function POST(req: Request) {
    try {
        const result = await getVerifiedProvider()
        if ("error" in result && result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }
        const { provider } = result as { provider: { id: string } }

        const body = await req.json()
        const {
            name,
            nameAr,
            description,
            brand,
            sku,
            price,
            stock,
            categoryId,
            isActive,
        } = body

        if (!name?.trim()) {
            return NextResponse.json(
                { error: "Product name is required" },
                { status: 400 }
            )
        }

        const priceNum = Number(price)
        if (Number.isNaN(priceNum) || priceNum < 0) {
            return NextResponse.json(
                { error: "Valid price is required" },
                { status: 400 }
            )
        }

        const stockNum = stock === undefined || stock === "" ? 0 : Number(stock)
        if (Number.isNaN(stockNum) || stockNum < 0) {
            return NextResponse.json(
                { error: "Stock must be a non-negative number" },
                { status: 400 }
            )
        }

        const product = await prisma.product.create({
            data: {
                providerId: provider.id,
                name: name.trim(),
                nameAr: nameAr?.trim() || null,
                description: description?.trim() || null,
                brand: brand?.trim() || null,
                sku: sku?.trim() || null,
                price: priceNum,
                stock: stockNum,
                categoryId: categoryId || null,
                isActive: isActive !== false,
                images: [],
            },
        })

        return NextResponse.json({ product }, { status: 201 })
    } catch (error) {
        console.error("Create product error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
