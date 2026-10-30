import type { Metadata } from "next"
import LegalDoc from "@/components/legal/LegalDoc"
import { TERMS_SECTIONS } from "@/lib/shared/legal"

export const metadata: Metadata = {
    title: "Terms of use",
    description: "The rules for using Bayna, for customers and for shops.",
}

export default function TermsPage() {
    return (
        <LegalDoc
            title="Terms of use"
            intro="These are the rules for using Bayna, whether you come to compare prices or to sell. We have tried to write them in plain words."
            sections={TERMS_SECTIONS}
            other={{ href: "/privacy", label: "the Privacy policy" }}
        />
    )
}
