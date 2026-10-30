// lib/shared/site.ts
// Facts about the site that the public pages (Terms, Privacy, Contact) print. They come from environment
// variables so the real company details are never typed into code; when one is missing the pages still
// read correctly and point people to the Contact page.
//
//   NEXT_PUBLIC_COMPANY_NAME     the company that runs Bayna (as registered)
//   NEXT_PUBLIC_COMPANY_ADDRESS  its registered address
//   NEXT_PUBLIC_CONTACT_EMAIL    where people write to (support, data requests)

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null)

export const SITE = {
    name: "Bayna",
    companyName: clean(process.env.NEXT_PUBLIC_COMPANY_NAME),
    companyAddress: clean(process.env.NEXT_PUBLIC_COMPANY_ADDRESS),
    contactEmail: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
} as const

/**
 * The version of the Terms and the Privacy policy. Change it whenever either text changes in a way that
 * people should accept again; it is saved with each sign-up (User.termsVersion) as the proof of what they accepted.
 */
export const LEGAL_VERSION = "2026-10-27"

/** The details still missing before the pages can go live (shown to the team in development only). */
export function missingSiteDetails(site: { companyName: string | null; companyAddress: string | null; contactEmail: string | null } = SITE): string[] {
    const out: string[] = []
    if (!site.companyName) out.push("NEXT_PUBLIC_COMPANY_NAME")
    if (!site.companyAddress) out.push("NEXT_PUBLIC_COMPANY_ADDRESS")
    if (!site.contactEmail) out.push("NEXT_PUBLIC_CONTACT_EMAIL")
    return out
}

/** "2026-10-27" -> "27 October 2026" */
export function formatLegalDate(version: string): string {
    const [y, m, d] = version.split("-").map(Number)
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    return `${d} ${months[m - 1]} ${y}`
}
