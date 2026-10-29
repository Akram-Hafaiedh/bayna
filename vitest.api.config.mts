// vitest.api.config.mts
// API and permission tests: tests/api/**/*.test.ts, run with `npm run test:api`.
// They call route handlers and guards directly against a real, separate Postgres database (TEST_DATABASE_URL,
// see tests/api/test-db.ts). The database is reset and seeded before each run (global-setup.ts); set
// TEST_API_KEEP_DB=1 to skip that and reuse it, which is faster while you are writing a test.
// Pure logic has its own, much faster run: `npm run test:unit`.
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"
import { testDatabaseUrl } from "./tests/api/test-db"

const url = testDatabaseUrl()

export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
    test: {
        environment: "node",
        include: ["tests/api/**/*.test.ts"],
        globalSetup: ["tests/api/global-setup.ts"],
        setupFiles: ["tests/api/setup.ts"],
        // Everything the code under test reads as DATABASE_URL is the test database. Plan limits are off, so a
        // PLAN_LIMITS=on in your .env cannot make the team and product tests depend on the demo plan.
        env: { DATABASE_URL: url, NODE_ENV: "test", PLAN_LIMITS: "off" },
        // One file at a time: the tests share one database
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 120_000,
    },
})
