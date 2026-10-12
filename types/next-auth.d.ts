import { Role } from "@/app/generated/prisma/enums"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: Role
        } & DefaultSession["user"]
        loginSessionId?: string
    }

    interface User {
        role: Role
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        role?: Role
        loginSessionId?: string
    }
}
