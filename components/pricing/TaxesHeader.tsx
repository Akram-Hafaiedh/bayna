// components/pricing/TaxesHeader.tsx
// The title row of the Taxes page, laid out like the Products page (title on the left, the main action on the right).
export default function TaxesHeader({ children }: { children?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Taxes</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    You enter the price before tax. Each product carries the taxes you choose, and buyers see the price with tax.
                </p>
            </div>
            {children}
        </div>
    )
}
