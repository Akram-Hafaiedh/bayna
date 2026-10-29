// components/Providers.tsx
"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/ui/Toast"
import { ConfirmProvider } from "@/components/ui/ConfirmDialog"
import ViewAsBanner from "@/components/admin/ViewAsBanner"

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <ConfirmProvider>
                    <ViewAsBanner />
                    {children}
                </ConfirmProvider>
            </ToastProvider>
        </SessionProvider>
    )
}
