import type { Metadata } from "next"
import ComingSoon from "@/components/provider/ComingSoon"

export const metadata: Metadata = { title: "Taxes" }

export default function Page() {
    return <ComingSoon title="Taxes" description="Tax settings and tax reports for this shop. Planned." />
}
