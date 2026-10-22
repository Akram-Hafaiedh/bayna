// prisma/seed/index.ts
// The main seeder. Runs the seeders in seeders/index.ts in order; each one owns one kind of data.
//
//   npm run seed                                  everything (reference + demo + test data)
//   npm run seed -- --list                        what exists, in running order
//   npm run seed products                         one seeder, plus what it needs (shops, catalogue, ...)
//   npm run seed categories catalogue             several (in the right order, whatever order you type)
//   npm run seed products -- --exact              exactly that one, without what it needs
//   npm run seed -- --skip products,users    everything except these
//   npm run seed -- --kind reference              only one kind: reference | demo | test
//   npx tsx prisma/seed/index.ts products         the same, without npm (db:seed works like seed)
//
// With NODE_ENV=production only `reference` seeders run (demo and test data have known passwords);
// set SEED_ALLOW_DEMO=1 to override. Safe to run again: seeders are idempotent.
import "dotenv/config"
import { PrismaClient } from "../../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { SeedError, type SeedKind } from "./core"
import { SEEDERS } from "./seeders"
import { checkSeeders, planRun } from "./plan"

function openDatabase() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    return {
        prisma,
        close: async () => {
            await prisma.$disconnect()
            await pool.end()
        },
    }
}

const VALUE_FLAGS = ["--only", "--skip", "--kind"]
const BOOLEAN_FLAGS = ["--list", "--exact", "--help"]

function parseArgs(argv: string[]) {
    const names: string[] = []
    const values = new Map<string, string[]>()
    const flags = new Set<string>()
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (VALUE_FLAGS.includes(a)) {
            const v = argv[i + 1]
            if (!v || v.startsWith("--")) throw new SeedError(`${a} needs a value, for example ${a} categories,catalogue`)
            values.set(a, v.split(",").map((s) => s.trim()).filter(Boolean))
            i++
        } else if (BOOLEAN_FLAGS.includes(a)) {
            flags.add(a)
        } else if (a.startsWith("--")) {
            throw new SeedError(`Unknown option ${a}. Try: npm run seed -- --help`)
        } else {
            // A bare word is a seeder name (commas allowed: "categories,catalogue")
            names.push(...a.split(",").map((s) => s.trim()).filter(Boolean))
        }
    }
    return { names, values, flags }
}

function help() {
    console.log(`Seeds the database. Safe to run again.

  npm run seed                          everything
  npm run seed products                 one seeder plus what it needs
  npm run seed categories catalogue     several seeders
  npm run seed products -- --exact      exactly the named seeders, nothing before them
  npm run seed -- --skip products       everything except these
  npm run seed -- --kind demo           only reference | demo | test seeders
  npm run seed -- --list                the seeders, in running order

Seeders: ${SEEDERS.map((s) => s.name).join(", ")}`)
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    if (args.flags.has("--help")) return help()
    const wiring = checkSeeders(SEEDERS)
    if (wiring.length) throw new SeedError("The seeder list is wrong:\n" + wiring.join("\n"))

    if (args.flags.has("--list")) {
        console.log("Seeders, in running order:\n")
        for (const s of SEEDERS) {
            console.log(`  ${s.name.padEnd(12)} ${s.kind.padEnd(10)} ${s.description}${s.needs.length ? `  (needs: ${s.needs.join(", ")})` : ""}`)
        }
        return
    }

    const only = [...args.names, ...(args.values.get("--only") ?? [])]
    const production = process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_DEMO !== "1"
    const plan = planRun(SEEDERS, {
        only: only.length ? only : undefined,
        exact: args.flags.has("--exact"),
        skip: args.values.get("--skip"),
        kind: args.values.get("--kind")?.[0] as SeedKind | undefined,
        production,
    })
    if (plan.problems.length) throw new SeedError(plan.problems.join("\n"))
    for (const s of plan.skippedForProduction) console.log(`Skipping ${s} (demo and test data are not seeded with NODE_ENV=production; set SEED_ALLOW_DEMO=1 to override)`)
    if (plan.run.length === 0) {
        console.log("Nothing to run.")
        return
    }
    const asked = new Set(only)
    if (only.length) {
        const extra = plan.run.filter((s) => !asked.has(s.name)).map((s) => s.name)
        if (extra.length) console.log(`Also running what ${only.join(", ")} need${only.length === 1 ? "s" : ""}: ${extra.join(", ")}`)
    }

    const { prisma, close } = openDatabase()
    try {
        for (const seeder of plan.run) {
            console.log(`\n== ${seeder.name} (${seeder.kind}): ${seeder.description}`)
            const summary = await seeder.run({ prisma, log: (m) => console.log(`   ${m}`) })
            console.log(`   -> ${summary}`)
        }
        console.log("\nDone.")
    } finally {
        await close()
    }
}

main().catch((e) => {
    if (e instanceof SeedError) console.error(`\n${e.message}`)
    else console.error(e)
    process.exitCode = 1
})
