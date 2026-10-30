// lib/legal.ts
// The text of the Privacy policy and the Terms of use, as data (so it can be translated later and tested).
// It describes what Bayna does today; when a feature changes what is collected or promised, change the text
// here AND bump LEGAL_VERSION in lib/site.ts. A DRAFT: have a lawyer read it before launch.
import { SITE } from "./site"

export type LegalSection = { id: string; title: string; paragraphs?: string[]; list?: string[]; after?: string[] }

const NAME = SITE.name
/** Who runs the service, as a sentence fragment */
const OPERATOR = SITE.companyName ? `${SITE.companyName}` : `the ${NAME} team`
/** How to reach us, as a sentence fragment */
const REACH = SITE.contactEmail ? `write to ${SITE.contactEmail} or use the Contact page` : "use the Contact page"

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
        id: "who",
        title: "Who we are",
        paragraphs: [
            `${NAME} is a marketplace that helps people in Tunisia compare prices from local shops and decide whether a trip is worth it. It is run by ${OPERATOR}${SITE.companyAddress ? `, ${SITE.companyAddress}` : ""}.`,
            `This page explains what personal information we collect, why, who can see it, and what you can ask us to do with it. To ask anything about it, ${REACH}.`,
        ],
    },
    {
        id: "collect",
        title: "What we collect",
        list: [
            "Your account: your name, your email address, your phone number if you give one, and your password. We never store the password itself, only a scrambled version that cannot be turned back into it.",
            "If you run a shop: the shop's name, description, phone and WhatsApp numbers, street address, city, governorate and the position of its pin on the map, plus its products and prices.",
            "If you run a business: its company name and, if you fill them in, its legal name, tax number, trade registry number and billing contact.",
            "Your team: the people you invite, the role each one has, and the invitations you send.",
            "Sign-in information: when and from which device, browser and IP address you signed in, so you can see and end your own sessions and so we can spot misuse.",
            "An activity log: who changed what and when (for example a price, a role or a shop address), kept to protect accounts and to settle disagreements.",
            "Notifications we send you inside the service, and messages you send us.",
        ],
    },
    {
        id: "public",
        title: "What is public and what is not",
        paragraphs: [
            "Once a shop is approved, what you enter about it is meant to be seen by customers: its name, description, phone and WhatsApp numbers, address, map pin, and its products and prices.",
            "Your email address, your password and your sign-in information are never shown to customers. People in your business or shop team see each other according to their roles.",
        ],
    },
    {
        id: "why",
        title: "Why we use it",
        list: [
            "To run your account, your shop and your team.",
            "To show shops, products and prices to customers, with distance and travel cost.",
            "To keep the service safe: spotting misuse, ending sessions, and reviewing shops and listings.",
            "To answer you when you contact us, and to send notices about your account or these terms.",
            "To meet our legal obligations.",
        ],
        after: ["We do not sell your information and we do not show advertising."],
    },
    {
        id: "share",
        title: "Who else sees it",
        list: [
            `The ${NAME} staff who run and support the service, only as far as their work needs.`,
            "Companies that host the service or send emails for us, who may only use the information to do that work.",
            "Authorities, when the law requires us to give information.",
        ],
    },
    {
        id: "cookies",
        title: "Cookies",
        paragraphs: [
            "We use only the cookies the service needs to work: one that keeps you signed in, and small ones that remember which shop or business you were working in. We do not use advertising or tracking cookies today. If that changes we will update this page and ask you first where the law requires it.",
        ],
    },
    {
        id: "keep",
        title: "How long we keep it",
        paragraphs: [
            "We keep your information while your account is open. When you ask us to close your account, we delete or anonymise your personal information, except what we must keep for legal reasons or to prevent fraud, and the activity log entries that other people's records depend on.",
        ],
    },
    {
        id: "rights",
        title: "Your rights",
        paragraphs: [
            `You can ask us to show you the information we hold about you, to correct it, to stop using it in some ways, or to delete it. ${REACH.charAt(0).toUpperCase() + REACH.slice(1)} and tell us which account you mean; we may need to check it is really you.`,
            "We handle personal information in line with Tunisian law on the protection of personal data (Organic Law no. 2004-63). You also have the right to complain to the national authority, the Instance Nationale de Protection des Données Personnelles (INPDP).",
        ],
    },
    {
        id: "security",
        title: "Keeping it safe",
        paragraphs: [
            "Passwords are stored scrambled, people only see what their role allows, you can see and end your own sessions, and changes to accounts and shops are logged. No system is perfectly safe, so choose a password you use nowhere else.",
        ],
    },
    {
        id: "changes",
        title: "Changes to this page",
        paragraphs: [
            "When we change this policy in a way that matters we will tell you in the service and update the date at the top of the page.",
        ],
    },
]

export const TERMS_SECTIONS: LegalSection[] = [
    {
        id: "about",
        title: "About Bayna and these terms",
        paragraphs: [
            `${NAME} is run by ${OPERATOR}. It helps you find and compare prices from local shops. The sale itself is between you and the shop: ${NAME} is not the seller and does not guarantee a product, a price or a shop.`,
            `By creating an account or using ${NAME} you agree to these terms and to the Privacy policy. If you do not agree, please do not use the service.`,
        ],
    },
    {
        id: "account",
        title: "Your account",
        list: [
            "You must be able to enter into a contract under Tunisian law.",
            "Give true information and keep it up to date.",
            "Keep your password to yourself. What happens in your account is your responsibility, so tell us quickly if you think someone else is using it.",
        ],
    },
    {
        id: "customers",
        title: "If you are a customer",
        paragraphs: [
            "Prices, stock and opening details come from the shops and can be out of date. Distances and travel costs are estimates. Check with the shop before you travel.",
        ],
    },
    {
        id: "shops",
        title: "If you run a shop",
        list: [
            "A new shop is reviewed by us before it goes live, and we may refuse it or ask for changes.",
            "What you publish must be true: your address, your map pin, your products and your prices. Keep them up to date.",
            "You may only list things you are allowed to sell under Tunisian law.",
            "A business is responsible for its team: what the people you invite do in your business and your shops is your responsibility.",
            "We may block a product, or suspend a shop, that breaks these terms or the law, or that puts customers at risk. We will tell you why.",
        ],
    },
    {
        id: "plans",
        title: "Plans and payment",
        paragraphs: [
            `${NAME} has a free plan and paid plans. A plan belongs to a business and sets limits, such as how many shops, products and team members it can have. Prices are in Tunisian dinars (TND) and are shown on the Plans page.`,
            "Paid plans are set up with us for now. If a limit is reached you keep everything you already have, but cannot add more until you change plan or free some room. If a paid period ends, the business returns to the free plan and keeps its shops and products.",
            "We may change plans and prices. A change applies from your next period, and we will tell you before it does.",
        ],
    },
    {
        id: "use",
        title: "Using Bayna properly",
        paragraphs: ["Please do not:"],
        list: [
            "publish false or misleading prices, products or shop details;",
            "pretend to be another person or company;",
            "collect information from the service in bulk, or overload it;",
            "try to get into accounts or parts of the service that are not yours, or test its security without our written permission;",
            "use the service for anything unlawful.",
        ],
    },
    {
        id: "ending",
        title: "Suspending and closing accounts",
        paragraphs: [
            "We may suspend or close an account that breaks these terms, is used to harm others or is used unlawfully. You can stop using Bayna at any time, and you can ask us to close your account.",
        ],
    },
    {
        id: "content",
        title: "What you publish",
        paragraphs: [
            `What you publish stays yours. You allow ${NAME} to show it, store it and use it to run the service, including showing your shop and products to customers. The ${NAME} name, logo and software belong to us.`,
        ],
    },
    {
        id: "liability",
        title: "Our responsibility",
        paragraphs: [
            `We work to keep ${NAME} running and accurate, but we provide it as it is. We are not responsible for what shops publish or sell, or for a trip that turns out not to be worth it. Nothing in these terms removes a responsibility that the law does not allow us to remove.`,
        ],
    },
    {
        id: "changes",
        title: "Changes to these terms",
        paragraphs: [
            "We may update these terms. When a change matters we will tell you in the service and update the date at the top of the page. Using Bayna after that means you accept the new terms.",
        ],
    },
    {
        id: "law",
        title: "Law and contact",
        paragraphs: [
            `These terms are governed by Tunisian law, and disputes go to the competent courts of Tunisia. Questions about these terms: ${REACH}.`,
        ],
    },
]
