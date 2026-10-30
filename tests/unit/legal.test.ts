// lib/legal.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { PRIVACY_SECTIONS, TERMS_SECTIONS, type LegalSection } from "@/lib/shared/legal"

const docs: [string, LegalSection[]][] = [["privacy", PRIVACY_SECTIONS], ["terms", TERMS_SECTIONS]]

test("every section has a unique id, a title and some text", () => {
    for (const [name, sections] of docs) {
        const ids = sections.map((s) => s.id)
        assert.equal(new Set(ids).size, ids.length, `${name}: duplicate id`)
        for (const s of sections) {
            assert.ok(s.title.trim().length > 0, `${name}/${s.id}: no title`)
            const text = [...(s.paragraphs ?? []), ...(s.list ?? []), ...(s.after ?? [])]
            assert.ok(text.length > 0, `${name}/${s.id}: no text`)
            for (const t of text) assert.ok(t.trim().length > 0 && !t.includes("undefined") && !t.includes("null"), `${name}/${s.id}: bad text "${t}"`)
        }
    }
})

test("the privacy policy covers the basics people look for", () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id)
    for (const need of ["collect", "public", "share", "cookies", "keep", "rights"]) assert.ok(ids.includes(need), need)
})

test("the terms cover accounts, shops, plans and ending an account", () => {
    const ids = TERMS_SECTIONS.map((s) => s.id)
    for (const need of ["account", "shops", "plans", "ending", "liability", "law"]) assert.ok(ids.includes(need), need)
})

test("without company details the text still reads cleanly and points to the Contact page", () => {
    const all = [...PRIVACY_SECTIONS, ...TERMS_SECTIONS].flatMap((s) => [...(s.paragraphs ?? []), ...(s.list ?? [])]).join(" ")
    assert.ok(all.includes("Contact page"))
    assert.ok(!all.includes(", null") && !all.includes("undefined"))
})
