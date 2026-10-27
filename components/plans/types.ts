// components/plans/types.ts
// What the plan components need from a plan (plain data, so a server page can hand it to them).
import type { Features, Limits } from "@/lib/plans"

export type PlanRow = {
    key: string
    name: string
    description: string
    priceMonthly: number | null
    priceYearly: number | null
    limits: Limits
    features: Features
}
