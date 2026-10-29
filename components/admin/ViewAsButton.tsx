"use client"
// components/admin/ViewAsButton.tsx
// "View as" on the admin user page: opens the question (ViewAsDialog) for this person.
import { useState } from "react"
import ViewAsDialog from "@/components/admin/ViewAsDialog"

export default function ViewAsButton({ publicUserId, name }: { publicUserId: string; name: string }) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:border-zinc-300"
            >
                View as {name}
            </button>
            {open && <ViewAsDialog publicUserId={publicUserId} name={name} onClose={() => setOpen(false)} />}
        </>
    )
}
