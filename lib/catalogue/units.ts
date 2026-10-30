// lib/catalogue/units.ts
import { Unit } from "@/app/generated/prisma/enums"

/** Short label shown next to prices and quantities. */
export const UNIT_LABELS: Record<Unit, string> = {
    PIECE: "piece",
    BAG: "bag",
    METER: "m",
    SQUARE_METER: "m²",
    CUBIC_METER: "m³",
    TON: "ton",
    ROLL: "roll",
    LITER: "L",
    OTHER: "other",
}

/** Full label for dropdowns. */
export const UNIT_NAMES: Record<Unit, string> = {
    PIECE: "Piece",
    BAG: "Bag",
    METER: "Meter (m)",
    SQUARE_METER: "Square meter (m²)",
    CUBIC_METER: "Cubic meter (m³)",
    TON: "Ton",
    ROLL: "Roll",
    LITER: "Liter (L)",
    OTHER: "Other",
}

export const UNIT_OPTIONS = (Object.values(Unit) as Unit[]).map((value) => ({
    value,
    label: UNIT_NAMES[value],
}))