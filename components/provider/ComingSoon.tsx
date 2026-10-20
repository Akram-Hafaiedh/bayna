// A placeholder for a shop module that is planned but not built yet.
export default function ComingSoon({ title, description }: { title: string; description: string }) {
    return (
        <div className="max-w-xl space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-center">
                <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">Coming soon</span>
                <p className="mx-auto mt-3 max-w-sm text-sm text-zinc-500">{description}</p>
            </div>
        </div>
    )
}
