# Sidebar Restructure — Design Spec

**Date:** 2026-07-08
**Branch:** `round-2-dashboard-customers-collections`

## Overview

Restructure the admin sidebar from a flat nav list to a Shopify-style hierarchical menu with hover-triggered dropdown sub-menus. The sidebar currently has 9 flat links. After this change, it will have 11 items, 8 of which expand into sub-menus on hover.

## New Sidebar Structure

### Main Nav (top section)

| Item          | Type     | Sub-items                                                                          |
| ------------- | -------- | ---------------------------------------------------------------------------------- |
| Dashboard     | link     | —                                                                                  |
| Products      | dropdown | Collections, Inventory, Purchase Orders, Transfers, Gift Cards                     |
| Customers     | link     | —                                                                                  |
| Content       | dropdown | Pages, Blog Posts, Files & Media Library, Metafields                               |
| Finances      | dropdown | Financial Overview, Payouts & Settlements, Capital / Financing, Tax Liabilities    |
| Analytics     | dropdown | Dashboards, Reports, Live View, Custom Reports                                     |
| Marketing     | dropdown | Campaigns, Automation                                                              |
| Discounts     | dropdown | Discount Codes, Automatic Discounts, Gift Cards / Store Credit, Campaign Scheduler |
| Sales Channel | dropdown | Online Store, Point of Sale, Shop                                                  |

### Secondary Nav (bottom section, `mt-auto`)

| Item     | Type     | Sub-items                                                                                                  |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Settings | dropdown | Users & Permissions, Store Details, Payments, Checkout, Shipping & Delivery, Taxes & Duties, Notifications |
| Help     | link     | —                                                                                                          |

## URL Mapping

Existing pages keep their current routes. New sub-item routes are defined for future pages:

| Sub-item                    | URL                           |
| --------------------------- | ----------------------------- |
| Dashboard                   | `/dashboard`                  |
| Products (header)           | —                             |
| › Collections               | `/collections`                |
| › Inventory                 | `/products/inventory`         |
| › Purchase Orders           | `/products/purchase-orders`   |
| › Transfers                 | `/products/transfers`         |
| › Gift Cards                | `/products/gift-cards`        |
| Customers                   | `/customers`                  |
| Content (header)            | —                             |
| › Pages                     | `/content/pages`              |
| › Blog Posts                | `/content/blog`               |
| › Files & Media Library     | `/content/files`              |
| › Metafields                | `/content/metafields`         |
| Finances (header)           | —                             |
| › Financial Overview        | `/finances/overview`          |
| › Payouts & Settlements     | `/finances/payouts`           |
| › Capital / Financing       | `/finances/capital`           |
| › Tax Liabilities           | `/finances/taxes`             |
| Analytics (header)          | —                             |
| › Dashboards                | `/analytics/dashboards`       |
| › Reports                   | `/analytics/reports`          |
| › Live View                 | `/analytics/live-view`        |
| › Custom Reports            | `/analytics/custom-reports`   |
| Marketing (header)          | —                             |
| › Campaigns                 | `/marketing/campaigns`        |
| › Automation                | `/marketing/automation`       |
| Discounts (header)          | —                             |
| › Discount Codes            | `/discounts/codes`            |
| › Automatic Discounts       | `/discounts/automatic`        |
| › Gift Cards / Store Credit | `/discounts/gift-cards`       |
| › Campaign Scheduler        | `/discounts/scheduler`        |
| Sales Channel (header)      | —                             |
| › Online Store              | `/sales-channel/online-store` |
| › Point of Sale             | `/sales-channel/pos`          |
| › Shop                      | `/sales-channel/shop`         |
| Settings (header)           | —                             |
| › Users & Permissions       | `/settings/users`             |
| › Store Details             | `/settings/store-details`     |
| › Payments                  | `/settings/payments`          |
| › Checkout                  | `/settings/checkout`          |
| › Shipping & Delivery       | `/settings/shipping`          |
| › Taxes & Duties            | `/settings/taxes`             |
| › Notifications             | `/settings/notifications`     |
| Help                        | `/help`                       |

## Icon Mapping

All icons from Lucide (already available via `@repo/ui/icons`):

| Item                        | Icon Component    |
| --------------------------- | ----------------- |
| Dashboard                   | `LayoutDashboard` |
| Products                    | `Package`         |
| › Collections               | `Folder`          |
| › Inventory                 | `Warehouse`       |
| › Purchase Orders           | `ClipboardList`   |
| › Transfers                 | `ArrowLeftRight`  |
| › Gift Cards                | `Tag`             |
| Customers                   | `Users`           |
| Content                     | `FileText`        |
| › Pages                     | `File`            |
| › Blog Posts                | `Newspaper`       |
| › Files & Media Library     | `Image`           |
| › Metafields                | `Code`            |
| Finances                    | `Banknote`        |
| › Financial Overview        | `TrendingUp`      |
| › Payouts                   | `Wallet`          |
| › Capital                   | `Building2`       |
| › Tax Liabilities           | `Landmark`        |
| Analytics                   | `BarChart3`       |
| › Dashboards                | `ChartColumn`     |
| › Reports                   | `FileBarChart`    |
| › Live View                 | `Radio`           |
| › Custom Reports            | `FileSpreadsheet` |
| Marketing                   | `Megaphone`       |
| › Campaigns                 | `Mail`            |
| › Automation                | `Workflow`        |
| Discounts                   | `Percent`         |
| › Discount Codes            | `Ticket`          |
| › Automatic Discounts       | `Zap`             |
| › Gift Cards / Store Credit | `Gift`            |
| › Scheduler                 | `Calendar`        |
| Sales Channel               | `Store`           |
| › Online Store              | `Globe`           |
| › Point of Sale             | `ShoppingBag`     |
| › Shop                      | `Smartphone`      |
| Settings                    | `Settings2`       |
| › Users & Permissions       | `Shield`          |
| › Store Details             | `Info`            |
| › Payments                  | `CreditCard`      |
| › Checkout                  | `ShoppingCart`    |
| › Shipping & Delivery       | `Truck`           |
| › Taxes & Duties            | `Receipt`         |
| › Notifications             | `Bell`            |
| Help                        | `CircleHelp`      |

## Component Architecture

### Data Model

```typescript
interface SubNavItem {
  title: string;
  url: string;
  icon?: React.ReactNode;
}

interface SidebarNavItem {
  title: string;
  url?: string; // undefined for dropdown-only headers
  icon: React.ReactNode;
  items?: SubNavItem[]; // present = hover-dropdown parent
}
```

When `items` is present and `url` is undefined, the parent acts as a non-navigable section header (hover expands sub-menu). When `items` is absent, the item renders as a plain clickable link (current behavior).

### Component Changes

**`packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`**

- Update `SidebarNavItem` type to include optional `items`
- Update `navMain` and `navSecondary` data arrays to match new structure
- Pass all items to `NavMain` and `NavSecondary`

**`packages/ui/src/components/blocks/dashboard/nav-main.tsx`**

- For items without `items[]`: render as today (plain `SidebarMenuButton` + `Link`)
- For items with `items[]`: render a wrapper `SidebarMenuItem` with:
  - `SidebarMenuButton` as the header (non-clickable, just displays icon+title+chevron)
  - `SidebarMenuSub` containing `SidebarMenuSubItem` + `SidebarMenuSubButton` for each sub-item
  - Visible via `group-hover` on the parent `SidebarMenuItem`

**`packages/ui/src/components/blocks/dashboard/nav-secondary.tsx`**

- Same hover-dropdown support added (needed for Settings)

### CSS Hover Strategy

`display: hidden` → `display: block` cannot be animated. Use opacity + visibility instead:

```tsx
<SidebarMenuItem className="group/menu-item">
  {/* Header — hover target */}
  <SidebarMenuButton className="peer/menu-button">
    {item.icon}
    <span>{item.title}</span>
    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-hover/menu-item:rotate-180" />
  </SidebarMenuButton>
  {/* Sub-menu — grid rows collapse height, opacity fades visibility */}
  <SidebarMenuSub className="grid grid-rows-[0fr] overflow-hidden invisible opacity-0 transition-all duration-200 group-hover/menu-item:grid-rows-[1fr] group-hover/menu-item:visible group-hover/menu-item:opacity-100">
    {item.items.map((sub) => (
      <SidebarMenuSubItem key={sub.title}>
        <SidebarMenuSubButton render={<Link href={sub.url} />}>
          <span>{sub.title}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    ))}
  </SidebarMenuSub>
</SidebarMenuItem>
```

Key points:

- `grid-rows-[0fr] overflow-hidden` collapses the sub-menu to zero height when inactive (no layout whitespace)
- `invisible opacity-0` → `group-hover:visible group-hover:opacity-100` provides a smooth 200ms fade
- Without the grid-row collapse, `invisible` elements still occupy physical height in the DOM
- No JS state, no timers, no React context
- Sub-menu stays visible while cursor is over the parent `SidebarMenuItem` (which contains both the header and the sub-menu)
- `ChevronDownIcon` rotates 180° on hover via `group-hover/menu-item:rotate-180`
- Transition on both chevron rotation and sub-menu fade/collapse via `transition-all duration-200`
- Sub-item icons omitted for a cleaner, indentation-only hierarchy (matching Shopify's pattern)

### Backward Compatibility

- `NavMain` accepts items with OR without `items` — existing flat usage still works
- `LinkComponent` prop continues to thread through for all link rendering
- No changes to `AppSidebarProps` public API (only internal data changes)

## Collapsed Sidebar Caveat

Currently `collapsible="offcanvas"` (sidebar slides away completely). If `icon` mode is added later, sub-menus will need React Portal rendering to avoid `overflow-hidden` clipping. This is a future concern — CSS-only covers the current mode.

## Files Changed

| File                                                            | Change                     |
| --------------------------------------------------------------- | -------------------------- |
| `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`   | Update types, data, icons  |
| `packages/ui/src/components/blocks/dashboard/nav-main.tsx`      | Add hover-dropdown support |
| `packages/ui/src/components/blocks/dashboard/nav-secondary.tsx` | Add hover-dropdown support |
