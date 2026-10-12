// app/api/provider/products/[id]/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

async function getOwnedProduct(productId: string) {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== Role.PROVIDER) {
        return { error: "Unauthorized", status: 401 as const }
    }

    const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
    })

    if (!provider || !provider.isVerified) {
        return { error: "Provider not found or not verified", status: 403 as const }
    }

    const product = await prisma.product.findFirst({
        where: { id: productId, providerId: provider.id },
    })

    if (!product) {
        return { error: "Product not found", status: 404 as const }
    }

    return { product, provider }
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const result = await getOwnedProduct(id)
        if ("error" in result && result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }
        return NextResponse.json({ product: (result as { product: unknown }).product })
    } catch (error) {
        console.error("Get product error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const result = await getOwnedProduct(id)
        if ("error" in result && result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }

        const body = await req.json()
        const data: Record<string, unknown> = {}

        if (body.name !== undefined) data.name = String(body.name).trim()
        if (body.nameAr !== undefined) data.nameAr = body.nameAr?.trim() || null
        if (body.description !== undefined)
            data.description = body.description?.trim() || null
        if (body.brand !== undefined) data.brand = body.brand?.trim() || null
        if (body.sku !== undefined) data.sku = body.sku?.trim() || null
        if (body.categoryId !== undefined)
            data.categoryId = body.categoryId || null
        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

        if (body.price !== undefined) {
            const priceNum = Number(body.price)
            if (Number.isNaN(priceNum) || priceNum < 0) {
                return NextResponse.json(
                    { error: "Valid price is required" },
                    { status: 400 }
                )
            }
            data.price = priceNum
        }

        if (body.stock !== undefined) {
            const stockNum = Number(body.stock)
            if (Number.isNaN(stockNum) || stockNum < 0) {
                return NextResponse.json(
                    { error: "Stock must be a non-negative number" },
                    { status: 400 }
                )
            }
            data.stock = stockNum
        }

        const product = await prisma.product.update({
            where: { id },
            data,
        })

        return NextResponse.json({ product })
    } catch (error) {
        console.error("Update product error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const result = await getOwnedProduct(id)
        if ("error" in result && result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }

        await prisma.product.delete({ where: { id } })
        return NextResponse.json({ message: "Product deleted" })
    } catch (error) {
        console.error("Delete product error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}
