import type { Metadata } from "next"
import ComingSoon from "@/components/shop/ComingSoon"

export const metadata: Metadata = { title: "Banks" }

export default function Page() {
    return <ComingSoon title="Banks" description="Bank accounts and payouts for this shop. Planned." />
}
