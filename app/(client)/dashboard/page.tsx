export default function ClientDashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Client Dashboard
            </h1>
            <p className="mt-2 text-zinc-500">
                Welcome! Here you will see your orders, saved products, and profile.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <h3 className="font-medium text-zinc-900">Recent Orders</h3>
                    <p className="mt-1 text-sm text-zinc-500">No orders yet.</p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <h3 className="font-medium text-zinc-900">Saved Products</h3>
                    <p className="mt-1 text-sm text-zinc-500">Coming soon.</p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <h3 className="font-medium text-zinc-900">Profile</h3>
                    <p className="mt-1 text-sm text-zinc-500">Manage your account.</p>
                </div>
            </div>
        </div>
    )
}