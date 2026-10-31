// prisma/seed/seeders/index.ts
// Every seeder, in the order they must run. To add one: create the file, add it here in the right place.
import type { Seeder } from "../core"
import { platform } from "./platform"
import { plans } from "./plans"
import { categories } from "./categories"
import { catalogue } from "./catalogue"
import { businesses } from "./businesses"
import { shops } from "./shops"
import { access } from "./access"
import { products } from "./products"
import { inventory } from "./inventory"
import { users } from "./users"

export const SEEDERS: Seeder[] = [platform, plans, categories, catalogue, businesses, shops, access, products, inventory, users]
