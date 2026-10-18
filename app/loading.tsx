// app/loading.tsx
// Shown while a page is loading. Pages with their own loading state keep it.
export default function Loading() {
    return (
        <div className="mx-auto flex min-h-[60vh] items-center justify-center px-4" role="status" aria-label="Loading">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        </div>
    )
}
