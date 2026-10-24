// components/shop/ShopSwitcherLoader.tsx
// Server part of the switcher: loads the person's shops. Render it inside <Suspense>.
import { connection } from "next/server"
import { auth } from "@/auth"
import { loadMyShops } from "@/lib/access/shops"
import ShopSwitcher from "./ShopSwitcher"

// publicId is the shop the page is about (from the address)
export default async function ShopSwitcherLoader({ publicId }: { publicId: string }) {
    await connection()
    const session = await auth()
    if (!session?.user?.id) return null

    const shops = await loadMyShops(session.user.id)
    return <ShopSwitcher shops={shops} activeId={shops.find((s) => s.publicId === publicId)?.id ?? null} />
}
