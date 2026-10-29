"use client"
// components/business/ShopActionsMenu.tsx
// The "Actions" dropdown in a shop's header: open the shop's dashboard, and move it along its life
// (send for approval, close, reopen). What is listed depends on the shop's status and on what the person
// may do; the server checks every action again.
import RowMenu, { type RowMenuItem } from "@/components/ui/RowMenu"
import { useShopActions } from "@/components/business/use-shop-actions"

type Move = "submit" | "close" | "reopen"
const LABEL: Record<Move, string> = { submit: "Send for approval", close: "Close shop", reopen: "Reopen shop" }

export default function ShopActionsMenu({
    shopId,
    shopPublicId,
    shopName,
    canOpen,
    moves,
}: {
    shopId: string
    shopPublicId: string
    shopName: string
    canOpen: boolean
    moves: Move[]
}) {
    const { busy, open, move } = useShopActions()
    const shop = { id: shopId, publicShopId: shopPublicId, name: shopName }
    const items: RowMenuItem[] = [
        ...(canOpen ? [{ label: "Open shop", onClick: () => void open(shop) }] : []),
        ...moves.map((m) => ({ label: LABEL[m], onClick: () => void move(shop, m), danger: m === "close" })),
    ]
    return <RowMenu label={`Actions for ${shopName}`} buttonLabel="Actions" items={items} disabled={busy === shopId} />
}
