// tests/api/test-db.ts
// Which database the API tests may use, and the check that keeps them away from your real one.
// The tests reset this database (every table emptied, migrations re-applied, demo data seeded), so it must
// be a separate database whose name ends in "_test". Put it in .env:
//
//   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bayna_test"
//
// and create it once:  createdb bayna_test   (or in pgAdmin: a new database named bayna_test)

export function testDatabaseUrl(): string {
    try { process.loadEnvFile(".env") } catch { } // Node 20.12+; ignored if .env is missing or already loaded
    const url = process.env.TEST_DATABASE_URL
    if (!url) {
        throw new Error(
            "TEST_DATABASE_URL is not set.\n" +
            "The API tests need their own database, because they reset it. Create one (for example bayna_test) and add to .env:\n" +
            '  TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/bayna_test"'
        )
    }
    const name = databaseName(url)
    if (!name.endsWith("_test")) {
        throw new Error(`Refusing to run: the test database is called "${name}". Its name must end in "_test" so the tests can never reset a real database.`)
    }
    return url
}

export function databaseName(url: string): string {
    try {
        return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""))
    } catch {
        return ""
    }
}
