import type { Metadata } from "next"
import ComingSoon from "@/components/shop/ComingSoon"

export const metadata: Metadata = { title: "Projects" }

export default function Page() {
    return <ComingSoon title="Projects" description="Several projects, each with its own kanban board, for your team's work. Planned." />
}
