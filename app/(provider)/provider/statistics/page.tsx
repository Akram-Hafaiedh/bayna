import type { Metadata } from "next"
import ComingSoon from "@/components/provider/ComingSoon"

export const metadata: Metadata = { title: "Statistics" }

export default function Page() {
    return <ComingSoon title="Statistics" description="Sales, orders and product performance for this shop. Planned." />
}
