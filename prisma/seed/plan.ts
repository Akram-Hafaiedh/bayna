// prisma/seed/plan.ts
// Which seeders run, in which order, for the command-line options. Pure (unit tested): no database.
import type { Seeder, SeedKind } from "./core"

export type PlanOptions = {
    /** Seeders to run. Unless `exact`, the seeders they need (and those need, ...) run first. */
    only?: string[]
    /** Run exactly the names in `only`, without their prerequisites */
    exact?: boolean
    skip?: string[]
    kind?: SeedKind
    /** NODE_ENV=production without SEED_ALLOW_DEMO: only `reference` seeders may run */
    production?: boolean
}

export type Plan = {
    run: Seeder[]
    /** names left out because they are demo or test data and this is production */
    skippedForProduction: string[]
    problems: string[]
}

const KINDS: SeedKind[] = ["reference", "demo", "test"]

export function planRun(all: Seeder[], opts: PlanOptions = {}): Plan {
    const problems: string[] = []
    const known = new Set(all.map((s) => s.name))
    for (const n of [...(opts.only ?? []), ...(opts.skip ?? [])]) {
        if (!known.has(n)) problems.push(`Unknown seeder "${n}". Known: ${all.map((s) => s.name).join(", ")}`)
    }
    if (opts.kind && !KINDS.includes(opts.kind)) problems.push(`Unknown kind "${opts.kind}". Known: ${KINDS.join(", ")}`)
    if (problems.length) return { run: [], skippedForProduction: [], problems }

    // Named seeders plus what they need, transitively (every `needs` entry is listed earlier in `all`)
    const wanted = new Set(opts.only ?? all.map((s) => s.name))
    if (opts.only && !opts.exact) {
        for (const s of [...all].reverse()) {
            if (wanted.has(s.name)) for (const need of s.needs) wanted.add(need)
        }
    }

    // Always the order of `all`, whatever order the names were typed in
    let chosen = all.filter((s) => wanted.has(s.name) && !(opts.skip ?? []).includes(s.name))
    if (opts.kind) chosen = chosen.filter((s) => s.kind === opts.kind)

    const skippedForProduction = opts.production ? chosen.filter((s) => s.kind !== "reference").map((s) => s.name) : []
    const run = opts.production ? chosen.filter((s) => s.kind === "reference") : chosen
    return { run, skippedForProduction, problems }
}

/** Problems with the seeder list itself: duplicate names, needs that do not exist or come later. */
export function checkSeeders(all: Seeder[]): string[] {
    const problems: string[] = []
    const seen = new Set<string>()
    for (const s of all) {
        if (seen.has(s.name)) problems.push(`Seeder "${s.name}" is listed twice`)
        for (const need of s.needs) {
            if (!seen.has(need)) problems.push(`Seeder "${s.name}" needs "${need}", which does not exist or runs after it`)
        }
        seen.add(s.name)
    }
    return problems
}
