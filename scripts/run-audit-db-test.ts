// Runs prisma/tests/audit-foundation.sql without needing the psql program (works on Windows).
// Usage: npm run test:audit-db        (reads DATABASE_URL from .env)
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "pg"

async function main() {
    try { process.loadEnvFile(".env") } catch { } // Node 20.12+; ignored if .env is missing or already loaded
    const url = process.env.DATABASE_URL
    if (!url) {
        console.error("DATABASE_URL is not set (.env)")
        process.exit(1)
    }
    // psql meta-commands (lines starting with a backslash) are not SQL
    const sql = readFileSync(join(process.cwd(), "prisma", "tests", "audit-foundation.sql"), "utf8")
        .split(/\r?\n/)
        .filter((line) => !line.startsWith("\\"))
        .join("\n")

    const client = new Client({ connectionString: url })
    let pass = 0
    client.on("notice", (n) => {
        if (n.message?.startsWith("PASS")) {
            pass++
            console.log(n.message)
        }
    })
    await client.connect()
    try {
        await client.query(sql)
        console.log(`\n${pass} checks passed`)
    } catch (e) {
        try { await client.query("ROLLBACK") } catch { }
        console.error(`\nFAILED after ${pass} passing checks:\n${(e as Error).message}`)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}

main()
