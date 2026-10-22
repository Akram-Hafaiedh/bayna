// prisma/seed/seeders/businesses.ts
// The demo companies (Business rows): the data (legal and billing details; the tax and registry numbers are
// made up and belong to nobody) and the seeder. A company is the legal entity behind one or more shops;
// shops point to it by name (see shops.ts). Their roles and owners come from the `access` seeder.
// Matched by name, so running twice is safe.
import type { Seeder } from "../core"

export type CompanySeed = {
    name: string
    legalName: string
    taxId: string
    registryNumber: string
    billingEmail: string
    billingPhone: string
    billingAddress: string
}

export const COMPANIES: CompanySeed[] = [
    {
        name: "Demo - Carthage Group SARL",
        legalName: "Carthage Group SARL",
        taxId: "0000001/A/M/000",
        registryNumber: "B0000001",
        billingEmail: "billing@carthage.demo.bayna.test",
        billingPhone: "+216 00 000 001",
        billingAddress: "Demo address, Tunis",
    },
    {
        name: "Demo - Sfax BTP SUARL",
        legalName: "Sfax BTP SUARL",
        taxId: "0000002/A/M/000",
        registryNumber: "B0000002",
        billingEmail: "billing@sfax-btp.demo.bayna.test",
        billingPhone: "+216 00 000 002",
        billingAddress: "Demo address, Sfax",
    },
    {
        name: "Demo - Sahel Trading SARL",
        legalName: "Sahel Trading SARL",
        taxId: "0000003/A/M/000",
        registryNumber: "B0000003",
        billingEmail: "billing@sahel.demo.bayna.test",
        billingPhone: "+216 00 000 003",
        billingAddress: "Demo address, Sousse",
    },
    {
        name: "Demo - Tunis Auto Group",
        legalName: "Tunis Auto Group SA",
        taxId: "0000004/A/M/000",
        registryNumber: "B0000004",
        billingEmail: "billing@auto-tunis.demo.bayna.test",
        billingPhone: "+216 00 000 004",
        billingAddress: "Demo address, Tunis",
    },
    {
        name: "Demo - Gabes Auto SARL",
        legalName: "Gabes Auto SARL",
        taxId: "0000005/A/M/000",
        registryNumber: "B0000005",
        billingEmail: "billing@auto-gabes.demo.bayna.test",
        billingPhone: "+216 00 000 005",
        billingAddress: "Demo address, Gabes",
    },
]

// ---------------------------------------------------------------------------
// The seeder
// ---------------------------------------------------------------------------

export const businesses: Seeder = {
    name: "businesses",
    kind: "demo",
    description: "Demo companies (legal and billing details)",
    needs: [],
    async run({ prisma }) {
        for (const c of COMPANIES) {
            const { name, ...details } = c
            const existing = await prisma.business.findFirst({ where: { name, deletedAt: null }, select: { id: true } })
            if (existing) await prisma.business.update({ where: { id: existing.id }, data: details })
            else await prisma.business.create({ data: { name, ...details } })
        }
        return `${COMPANIES.length} companies`
    },
}
