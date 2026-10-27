import type { Metadata } from "next"
import LegalDoc from "@/components/legal/LegalDoc"
import { PRIVACY_SECTIONS } from "@/lib/legal"

export const metadata: Metadata = {
    title: "Privacy policy",
    description: "What personal information Bayna collects, why, who can see it, and your rights.",
}

export default function PrivacyPage() {
    return (
        <LegalDoc
            title="Privacy policy"
            intro="This is what Bayna does with your personal information: what we collect, why, who can see it, and what you can ask us to do."
            sections={PRIVACY_SECTIONS}
            other={{ href: "/terms", label: "the Terms of use" }}
        />
    )
}
