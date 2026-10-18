// app/not-found.tsx
// Shown for any address that does not exist.
import Link from "next/link"

export default function NotFound() {
    return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-medium text-zinc-400">404</p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900">Page not found</h1>
            <p className="mt-2 text-sm text-zinc-500">This page does not exist or has moved.</p>
            <Link
                href="/"
                className="mt-6 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
                Go home
            </Link>
        </div>
    )
}
