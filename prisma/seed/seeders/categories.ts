// prisma/seed/seeders/categories.ts
// The category tree: root categories (the verticals) and their sub-categories. Upserted by slug.
import type { Seeder } from "../core"
import { ROOTS } from "./catalogue"

export const categories: Seeder = {
    name: "categories",
    kind: "reference",
    description: "Root categories and sub-categories",
    needs: [],
    async run({ prisma, log }) {
        let subs = 0
        for (const root of ROOTS) {
            const rootCategory = await prisma.category.upsert({
                where: { slug: root.slug },
                update: { name: root.name, sortOrder: root.sortOrder, parentId: null },
                create: { name: root.name, slug: root.slug, sortOrder: root.sortOrder },
            })
            for (const cat of root.categories) {
                await prisma.category.upsert({
                    where: { slug: cat.slug },
                    update: { name: cat.name, sortOrder: cat.sortOrder, parentId: rootCategory.id },
                    create: { name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder, parentId: rootCategory.id },
                })
                subs++
            }
            log(`${root.name}: ${root.categories.length} sub-categories`)
        }
        return `${ROOTS.length} root categories, ${subs} sub-categories`
    },
}
