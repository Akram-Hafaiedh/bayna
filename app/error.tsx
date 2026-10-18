"use client"
// app/error.tsx
// Shown when a page throws while rendering. `reset` tries to render the same page again.
import { useEffect } from "react"
import Link from "next/link"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
            <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-zinc-500">
                The page could not be shown. You can try again, or go back to the start.
            </p>
            {error.digest && <p className="mt-2 text-xs text-zinc-400">Reference: {error.digest}</p>}
            <div className="mt-6 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    className="inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                    Home
                </Link>
            </div>
        </div>
    )
}
