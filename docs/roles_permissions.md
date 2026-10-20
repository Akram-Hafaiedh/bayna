# Roles and permissions: proposed model (draft for review, 20 Oct 2026)

Nothing here is built yet. This is the list to review before R2e starts.

## How to read it

- **Module > sub-module > permission.** A permission key is `module.submodule.action`, for example `team.members.invite`.
- **Same actions everywhere.** Every sub-module that holds records uses the same four: `view`, `create`, `edit`, `delete`. `delete` always means move to Trash; `restore` brings it back. Extra actions are added only where something real needs them (publish, refund, accept...).
- **Three groups of modules:**
  - **Business modules (B):** only exist at business level (the company).
  - **Shared modules (B+S):** exist at both levels. At business level they mean "for the company", at shop level "for this shop".
  - **Shop modules (S):** about one storefront. A business role reaches them only through **Shop access** (see the end).
- **A role** = a name + a scope (business or shop) + ticked permissions. A person's access is the union of their roles. No grants, no denies.
- You can only tick what you hold yourself. The built-in **Owner** (business) and **Shop owner** (shop) hold everything and cannot be edited or deleted.
- The editor shows each module as a block with a master switch, sub-module switches, then single permissions, each with a one-line explanation. Half-ticked blocks show as partial.

## B. Business modules (company level only)

| Module | Sub-module | Permissions |
|---|---|---|
| Business profile | Details (name, contact) | view, edit |
| | Legal and tax (legal name, tax number, registry number) | view, edit |
| | Billing contact | view, edit |
| Shops | Shops of the business | view, create, edit, delete, restore |
| | Shop access (see the end) | manage |
| Plan and billing (R2d) | Subscription | view, edit |
| | Invoices | view, export |

## B+S. Shared modules

| Module | Sub-module | Permissions |
|---|---|---|
| Team | Members | view, invite, edit_role, suspend, remove, transfer_ownership |
| | Invitations | view, create, delete (revoke) |
| | Roles | view, create, edit, delete |
| Activity | Log | view, export |
| Insights | Dashboard | view |
| | Reports | view, export |
| Settings | Notifications | view, edit |
| | API keys | view, create, delete |
| | Webhooks | view, create, edit, delete |
| Support | Tickets | view, create, comment |
| | Feature requests | view, create, vote, comment |

## S. Shop modules (storefront)

| Module | Sub-module | Permissions |
|---|---|---|
| Shop profile | Details (name, description, contact, address, map pin) | view, edit |
| | Legal | view, edit |
| | Media (logo, cover, gallery) | view, create, edit, delete |
| | Opening hours | view, edit |
| | Fulfilment (pickup, delivery) | view, edit |
| | Delivery zones | view, create, edit, delete |
| | Shop status | view, close_temporarily, reopen, request_closure |
| Products | Listings | view, create, edit, delete, restore, archive, publish |
| | Prices | view, edit, view_history |
| | Images | view, create, edit, delete |
| | Bulk tools | import, export, edit |
| | Catalogue suggestions | view, create |
| Pricing | Price tiers | view, create, edit, delete |
| | Promotions | view, create, edit, delete |
| | Taxes | view, create, edit, delete |
| | Delivery fees | view, create, edit, delete |
| Inventory (R3) | Warehouses | view, create, edit, delete |
| | Stock levels | view, adjust, view_history |
| | Stock movements | view, create |
| | Reorder levels | view, edit |
| Orders | Requests | view_assigned, view_all, accept, reject, update_status, assign, cancel, refund, export |
| | Notes | view, create, edit, delete |
| | Messages | view, send |
| Customers | Contacts | view, message |
| Reviews | Ratings | view, reply, edit_reply, delete_reply |

Orders have no `delete`: an order is a record and is never removed, only cancelled or refunded.

## Shop access (how a business role reaches the shops)

- A business role has a **Shop access** section. It shows the S modules above and the shared modules, applied to **every shop** of the business.
- Master switch **"Manage all shops"** ticks everything in that section.
- Or tick only some modules or permissions: the role then does only part of the work in every shop.
- No Shop access permission ticked = the person sees the business dashboard only, never a shop dashboard.
- For one or two shops only, use a **shop role** in each of those shops (a "duplicate to another shop" button makes this quick).

## Your examples in this model

1. **Company HR who manages every shop's team:** business role with Team (all) at business level, plus Shop access > Team (members, invitations, roles).
2. **HR of shop 1 only:** shop role created inside shop 1 with Team > Members. Shop 2 (small team) has no such role.
3. **Company HR only:** business role with Team (business level) and no Shop access.

## Starter roles (editable copies, the owner may change or delete them)

- **Business:** Business owner (built in, fixed), HR, Accountant (billing, insights, taxes), Operations (Manage all shops).
- **Shop:** Shop owner (built in, fixed), Manager, Sales staff (products view/edit, orders), Stock keeper (inventory, stock), HR (team).

## Platform (Bayna admin) permissions

Unchanged for now. They get the same module tree layout later, when the admin side is reworked.

## Open points

- Names of modules and sub-modules (the "Shop profile" and "Settings" split above is a proposal).
- Whether Customers and Reviews stay separate modules or fold into Orders.
- Whether `Reorder levels` belongs to Inventory (proposed) or to Products.
