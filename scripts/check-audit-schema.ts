// scripts/check-audit-schema.ts
// Fails when a model in prisma/schema.prisma lacks the audit columns, so a new table cannot be
// added without them. Run: npm run audit:check
// The database side (triggers on every table) is checked by prisma/tests/audit-foundation.sql.
import { readFileSync } from "node:fs"
import { join } from "node:path"

const REQUIRED = ["createdAt", "updatedAt", "createdById", "updatedById"]
// ActivityLog is append-only: it has createdAt but is never updated.
const EXEMPT = new Set(["ActivityLog"])

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8")
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]

const problems: string[] = []
for (const [, name, body] of models) {
    if (EXEMPT.has(name)) continue
    const fields = new Set(
        body
            .split("\n")
            .map((line) => line.replace(/\/\/.*$/, "").trim())
            .filter((line) => line && !line.startsWith("@@"))
            .map((line) => line.split(/\s+/)[0])
    )
    const missing = REQUIRED.filter((field) => !fields.has(field))
    if (missing.length > 0) problems.push(`${name}: missing ${missing.join(", ")}`)
}

if (models.length === 0) {
    console.error("No models found. Is prisma/schema.prisma where this script expects it?")
    process.exit(1)
}
if (problems.length > 0) {
    console.error(`Audit columns missing on ${problems.length} model(s):`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
}
console.log(`OK: ${models.length - EXEMPT.size} models have ${REQUIRED.join(", ")}`)
