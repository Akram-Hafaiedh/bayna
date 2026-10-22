// vitest.config.ts
// Unit tests: lib/**/*.test.ts and prisma/seed/**/*.test.ts, run with `npm run test:unit` (once) or `npm run test:watch`.
// Database checks are separate: `npm run test:audit-db`.
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
    resolve: {
        // Same "@/..." alias as tsconfig.json, so tests can import app code the way the app does
        alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
    test: {
        environment: "node",
        include: ["lib/**/*.test.ts", "prisma/seed/**/*.test.ts"],
    },
})
