// components/business/BusinessSwitcherLoader.tsx
// Server part of the business picker: loads the person's businesses. Render it inside <Suspense>.
import { connection } from "next/server"
import { auth } from "@/auth"
import { loadMyBusinesses } from "@/lib/access/my-businesses"
import BusinessSwitcher from "./BusinessSwitcher"

export default async function BusinessSwitcherLoader() {
    await connection()
    const session = await auth()
    if (!session?.user?.id) return null
    const mine = await loadMyBusinesses(session.user.id)
    if (!mine || !mine.activeId) return null
    return <BusinessSwitcher businesses={mine.businesses} activeId={mine.activeId} />
}
