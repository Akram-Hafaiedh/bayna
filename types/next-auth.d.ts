import { Role } from "@/app/generated/prisma/enums"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: Role
        } & DefaultSession["user"]
        loginSessionId?: string
        /** Set while a platform staff member is viewing as `user` (lib/impersonation.ts). `user` is then the viewed person. */
        impersonation?: import("@/lib/impersonation").ViewAs
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
