// tests/api/global-setup.ts
// Runs once before the API tests: empties the test database, applies every migration and seeds the demo
// data (the accounts of prisma/seed/seeders/users.ts, password demo1234). TEST_API_KEEP_DB=1 skips it.
import { execSync } from "node:child_process"
import { testDatabaseUrl } from "./test-db"

export default function setup() {
    const url = testDatabaseUrl()
    if (process.env.TEST_API_KEEP_DB === "1") {
        console.log("TEST_API_KEEP_DB=1: reusing the test database as it is")
        return
    }
    // dotenv never overrides a variable that is already set, so Prisma and the seeder use the test database
    // (cast: Next.js types NODE_ENV as a fixed list of words)
    const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "test" } as NodeJS.ProcessEnv
    const run = (command: string) => execSync(command, { stdio: "inherit", env })

    console.log("\nResetting the test database ...")
    run("npx prisma migrate reset --force")
    console.log("Seeding it ...")
    // users needs access, businesses and shops; platform holds the staff roles; plans the plan rows
    run("npx tsx prisma/seed/index.ts platform plans users")
}
