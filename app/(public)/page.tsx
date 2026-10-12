import Link from "next/link"

export default function HomePage() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
                <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
                    Find the best price.
                    <br />
                    <span className="text-zinc-400">Know if it&apos;s worth the trip.</span>
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-zinc-600">
                    Compare real prices from local shops across Tunisia — including travel
                    cost — so you always make the smart choice.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                    <Link
                        href="/register"
                        className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                        Get started
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex h-11 items-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                        Log in
                    </Link>
                </div>
            </div>
        </div>
    )
}