// app/api/register/route.ts
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, name, role } = body

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            )
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return NextResponse.json(
                { error: "Email already in use" },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const user = await prisma.user.create({
            data: {
                email,
                name: name || null,
                password: hashedPassword,
                role: role === "PROVIDER" ? Role.PROVIDER : Role.BUYER,
            },
        })

        // If registering as provider, create empty Provider profile
        if (user.role === Role.PROVIDER) {
            await prisma.provider.create({
                data: {
                    userId: user.id,
                    businessName: name || "My Shop",
                    city: "Tunis", // temporary default
                },
            })
        }

        return NextResponse.json(
            { message: "User created successfully", userId: user.id },
            { status: 201 }
        )
    } catch (error) {
        console.error("Register error:", error)
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        )
    }
}