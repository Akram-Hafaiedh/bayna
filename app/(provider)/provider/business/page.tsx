import { redirect } from "next/navigation"

// The Business pages moved to their own area (account side): /business/profile
export default function ProviderBusinessMovedPage() {
    redirect("/business/profile")
}
