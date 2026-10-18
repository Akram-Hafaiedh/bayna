// components/provider/ShopSwitcherLoader.tsx
// Server part of the switcher: loads the person's shops. Render it inside <Suspense>.
import { connection } from "next/server"
import { auth } from "@/auth"
import { loadMyShops } from "@/lib/access/shops"
import { pickActiveShop } from "@/lib/access/active-shop"
import { readActiveShopHint } from "@/lib/access/active-cookie"
import ShopSwitcher from "./ShopSwitcher"

export default async function ShopSwitcherLoader() {
    await connection()
    const session = await auth()
    if (!session?.user?.id) return null

    const shops = await loadMyShops(session.user.id)
    const activeId = pickActiveShop(
        shops.filter((s) => s.status === "ACTIVE").map((s) => s.id),
        await readActiveShopHint()
    )
    return <ShopSwitcher shops={shops} activeId={activeId} />
}
