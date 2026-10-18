// components/Providers.tsx
"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/ui/Toast"
import { ConfirmProvider } from "@/components/ui/ConfirmDialog"

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
        </SessionProvider>
    )
}
