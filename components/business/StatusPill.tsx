// components/business/StatusPill.tsx
// The small coloured label of a shop's status. No client code, so pages of any kind can use it.
import { SHOP_STATUS_LABEL, SHOP_STATUS_TONE, type ShopStatusValue, type StatusTone } from "@/lib/shops/shop-status"

const TONE: Record<StatusTone, string> = {
    green: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-1 ring-red-200",
    zinc: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
}

export default function StatusPill({ status }: { status: ShopStatusValue }) {
    return (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[SHOP_STATUS_TONE[status]]}`}>
            {SHOP_STATUS_LABEL[status]}
        </span>
    )
}
