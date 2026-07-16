# Sidebar Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the admin sidebar from flat links to Shopify-style hierarchical hover-dropdown menus (8 drop-downs across 11 items).

**Architecture:** Pure CSS `group-hover` on `SidebarMenuItem` toggles grid rows (`0fr` → `1fr`) + `invisible opacity-0` → `visible opacity-100` on `SidebarMenuSub`. No JS state. Same `LinkComponent` threading pattern.

**Tech Stack:** React + shadcn sidebar (Base UI) + Tailwind CSS v4 + Lucide icons

## Global Constraints

- All icons from `@repo/ui/icons` (Lucide re-exports)
- `SidebarMenuSub` / `SidebarMenuSubButton` already exist in `@repo/ui/components/ui/sidebar`
- `NavMain` / `NavSecondary` live in `packages/ui/src/components/blocks/dashboard/`
- `AppSidebar` lives at `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`
- All sub-item URLs use plural kebab-case (e.g. `/products/gift-cards`, `/content/blog`)
- Existing page routes are unchanged; new URLs are defined for future pages
- Sub-item icons omitted (indentation-only hierarchy per spec)
- Typecheck must pass for `@repo/ui` and `admin` after each task
- Tests use vitest with jsdom + react plugin

---

### Task 1: Update NavMain with hover-dropdown support

**Files:**

- Modify: `packages/ui/src/components/blocks/dashboard/nav-main.tsx`
- Modify: `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx` (types only)
- Create: `packages/ui/src/components/blocks/dashboard/__tests__/nav-main.test.tsx`

**Interfaces:**

- Consumes: `NavMain` props `{ items: SidebarNavItem[], LinkComponent?: ElementType }`
- Produces: Expanded `SidebarNavItem` type with optional `items: SubNavItem[]`, updated `NavMain` that renders hover-dropdowns for items with `items[]`

- [ ] **Step 1: Extend `SidebarNavItem` type in `app-sidebar.tsx`**

```typescript
export interface SubNavItem {
  title: string;
  url: string;
}

export interface SidebarNavItem {
  title: string;
  url?: string;
  icon: React.ReactNode;
  items?: SubNavItem[];
}
```

- [ ] **Step 2: Update `NavMain` to render hover-dropdowns**

Read the current file, then replace the render logic:

```tsx
"use client";

import type { ElementType } from "react";

import { Button } from "@repo/ui/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/ui/components/ui/sidebar";
import { CirclePlusIcon, ChevronDownIcon, MailIcon } from "@repo/ui/icons";

interface SubNavItem {
  title: string;
  url: string;
}

export function NavMain({
  items,
  LinkComponent,
}: {
  items: {
    title: string;
    url?: string;
    icon?: React.ReactNode;
    items?: SubNavItem[];
  }[];
  LinkComponent?: ElementType;
}) {
  const Link = LinkComponent ?? "a";

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <CirclePlusIcon />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <MailIcon />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title} className="group/menu-item">
              {item.items ? (
                <>
                  <SidebarMenuButton>
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-hover/menu-item:rotate-180" />
                  </SidebarMenuButton>
                  <SidebarMenuSub className="grid grid-rows-[0fr] overflow-hidden invisible opacity-0 transition-all duration-200 group-hover/menu-item:grid-rows-[1fr] group-hover/menu-item:visible group-hover/menu-item:opacity-100">
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        <SidebarMenuSubButton render={<Link href={sub.url} />}>
                          <span>{sub.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </>
              ) : (
                <SidebarMenuButton
                  tooltip={item.title}
                  render={<Link href={item.url!} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

- [ ] **Step 3: Write test for NavMain hover-dropdown behavior**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavMain } from "../nav-main";

describe("NavMain", () => {
  const linkItems = [
    { title: "Dashboard", url: "/dashboard", icon: <span>icon</span> },
  ];

  const dropdownItems = [
    {
      title: "Products",
      icon: <span>icon</span>,
      items: [
        { title: "Collections", url: "/collections" },
        { title: "Inventory", url: "/products/inventory" },
      ],
    },
  ];

  it("renders link items as plain buttons", () => {
    render(<NavMain items={linkItems} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("renders dropdown items with chevron", () => {
    render(<NavMain items={dropdownItems} />);
    expect(screen.getByText("Products")).toBeInTheDocument();
    // Chevron should be present
    expect(document.querySelector(".lucide-chevron-down")).toBeTruthy();
  });

  it("renders sub-items inside drop-down", () => {
    render(<NavMain items={dropdownItems} />);
    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByText("Collections").closest("a")).toHaveAttribute("href", "/collections");
    expect(screen.getByText("Inventory")).toBeInTheDocument();
  });

  it("sub-items use LinkComponent when provided", () => {
    function MockLink({ href, children }: { href: string; children: React.ReactNode }) {
      return <a data-mock-link href={href}>{children}</a>;
    }
    render(<NavMain items={dropdownItems} LinkComponent={MockLink} />);
    expect(screen.getByText("Collections").closest("a")).toHaveAttribute("data-mock-link", "");
  });

  it("sub-items are hidden by default (opacity-0)", () => {
    const { container } = render(<NavMain items={dropdownItems} />);
    const sub = container.querySelector("[data-slot='sidebar-menu-sub']");
    expect(sub).toBeTruthy();
    expect(sub!.className).toContain("opacity-0");
    expect(sub!.className).toContain("invisible");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run --project ui -t "NavMain"`
Expected: FAIL — tests don't compile yet

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run --project ui -t "NavMain"`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/blocks/dashboard/nav-main.tsx packages/ui/src/components/blocks/dashboard/app-sidebar.tsx packages/ui/src/components/blocks/dashboard/__tests__/nav-main.test.tsx
git commit -m "feat(ui): add hover-dropdown sub-menus to NavMain"
```

---

### Task 2: Update NavSecondary with hover-dropdown support

**Files:**

- Modify: `packages/ui/src/components/blocks/dashboard/nav-secondary.tsx`
- Create: `packages/ui/src/components/blocks/dashboard/__tests__/nav-secondary.test.tsx`

**Interfaces:**

- Consumes: same `SidebarNavItem` type (items with optional `items[]`)
- Produces: `NavSecondary` renders hover-dropdown for items with `items[]`

- [ ] **Step 1: Update NavSecondary to render hover-dropdowns**

Replace the file content:

```tsx
"use client";

import type { ElementType, ReactNode } from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/ui/components/ui/sidebar";
import { ChevronDownIcon } from "@repo/ui/icons";

export interface NavSecondaryItem {
  title: string;
  url?: string;
  icon: ReactNode;
  items?: { title: string; url: string }[];
}

export function NavSecondary({
  items,
  LinkComponent,
  ...props
}: {
  items: NavSecondaryItem[];
  LinkComponent?: ElementType;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const Link = LinkComponent ?? "a";

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title} className="group/menu-item">
              {item.items ? (
                <>
                  <SidebarMenuButton>
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-hover/menu-item:rotate-180" />
                  </SidebarMenuButton>
                  <SidebarMenuSub className="grid grid-rows-[0fr] overflow-hidden invisible opacity-0 transition-all duration-200 group-hover/menu-item:grid-rows-[1fr] group-hover/menu-item:visible group-hover/menu-item:opacity-100">
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        <SidebarMenuSubButton render={<Link href={sub.url} />}>
                          <span>{sub.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </>
              ) : (
                <SidebarMenuButton render={<Link href={item.url!} />}>
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

- [ ] **Step 2: Write test**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavSecondary } from "../nav-secondary";

describe("NavSecondary", () => {
  const linkItems = [
    { title: "Help", url: "/help", icon: <span>icon</span> },
  ];

  const dropdownItems = [
    {
      title: "Settings",
      icon: <span>icon</span>,
      items: [
        { title: "Users & Permissions", url: "/settings/users" },
        { title: "Payments", url: "/settings/payments" },
      ],
    },
  ];

  it("renders link items", () => {
    render(<NavSecondary items={linkItems} />);
    expect(screen.getByText("Help")).toBeInTheDocument();
    expect(screen.getByText("Help").closest("a")).toHaveAttribute("href", "/help");
  });

  it("renders dropdown items with sub-items", () => {
    render(<NavSecondary items={dropdownItems} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Users & Permissions")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });

  it("sets mt-auto class via props spread", () => {
    const { container } = render(
      <NavSecondary items={linkItems} className="mt-auto" />
    );
    expect(container.firstChild).toHaveClass("mt-auto");
  });
});
```

- [ ] **Step 3: Run test**

Run: `pnpm vitest run --project ui -t "NavSecondary"`
Expected: PASS

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/blocks/dashboard/nav-secondary.tsx packages/ui/src/components/blocks/dashboard/__tests__/nav-secondary.test.tsx
git commit -m "feat(ui): add hover-dropdown sub-menus to NavSecondary"
```

---

### Task 3: Populate AppSidebar with full Shopify-style structure

**Files:**

- Modify: `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`

**Interfaces:**

- Consumes: Updated `SidebarNavItem` type (from Task 1), hover-dropdown support in `NavMain`/`NavSecondary`
- Produces: Fully populated sidebar with all 11 items and 8 drop-downs

- [ ] **Step 1: Replace nav data arrays in AppSidebar**

Update the `navMain` and `navSecondary` constants and icon imports:

```tsx
"use client";

import type { ElementType } from "react";

import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  PackageIcon,
  UsersIcon,
  FileTextIcon,
  BanknoteIcon,
  BarChart3Icon,
  MegaphoneIcon,
  PercentIcon,
  StoreIcon,
  Settings2Icon,
  CircleHelpIcon,
  CommandIcon,
} from "@repo/ui/icons";

export interface SubNavItem {
  title: string;
  url: string;
}

export interface SidebarNavItem {
  title: string;
  url?: string;
  icon: React.ReactNode;
  items?: SubNavItem[];
}

export interface AppSidebarUser {
  name: string;
  email: string;
  avatar: string;
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  tenantSwitcher?: React.ReactNode;
  user?: AppSidebarUser;
  onLogout?: () => void;
  LinkComponent?: ElementType;
}

const navMain: SidebarNavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  {
    title: "Products",
    icon: <PackageIcon />,
    items: [
      { title: "Collections", url: "/collections" },
      { title: "Inventory", url: "/products/inventory" },
      { title: "Purchase Orders", url: "/products/purchase-orders" },
      { title: "Transfers", url: "/products/transfers" },
      { title: "Gift Cards", url: "/products/gift-cards" },
    ],
  },
  { title: "Customers", url: "/customers", icon: <UsersIcon /> },
  {
    title: "Content",
    icon: <FileTextIcon />,
    items: [
      { title: "Pages", url: "/content/pages" },
      { title: "Blog Posts", url: "/content/blog" },
      { title: "Files & Media Library", url: "/content/files" },
      { title: "Metafields", url: "/content/metafields" },
    ],
  },
  {
    title: "Finances",
    icon: <BanknoteIcon />,
    items: [
      { title: "Financial Overview", url: "/finances/overview" },
      { title: "Payouts & Settlements", url: "/finances/payouts" },
      { title: "Capital / Financing", url: "/finances/capital" },
      { title: "Tax Liabilities", url: "/finances/taxes" },
    ],
  },
  {
    title: "Analytics",
    icon: <BarChart3Icon />,
    items: [
      { title: "Dashboards", url: "/analytics/dashboards" },
      { title: "Reports", url: "/analytics/reports" },
      { title: "Live View", url: "/analytics/live-view" },
      { title: "Custom Reports", url: "/analytics/custom-reports" },
    ],
  },
  {
    title: "Marketing",
    icon: <MegaphoneIcon />,
    items: [
      { title: "Campaigns", url: "/marketing/campaigns" },
      { title: "Automation", url: "/marketing/automation" },
    ],
  },
  {
    title: "Discounts",
    icon: <PercentIcon />,
    items: [
      { title: "Discount Codes", url: "/discounts/codes" },
      { title: "Automatic Discounts", url: "/discounts/automatic" },
      { title: "Gift Cards / Store Credit", url: "/discounts/gift-cards" },
      { title: "Campaign Scheduler", url: "/discounts/scheduler" },
    ],
  },
  {
    title: "Sales Channel",
    icon: <StoreIcon />,
    items: [
      { title: "Online Store", url: "/sales-channel/online-store" },
      { title: "Point of Sale", url: "/sales-channel/pos" },
      { title: "Shop", url: "/sales-channel/shop" },
    ],
  },
];

const navSecondary: SidebarNavItem[] = [
  {
    title: "Settings",
    icon: <Settings2Icon />,
    items: [
      { title: "Users & Permissions", url: "/settings/users" },
      { title: "Store Details", url: "/settings/store-details" },
      { title: "Payments", url: "/settings/payments" },
      { title: "Checkout", url: "/settings/checkout" },
      { title: "Shipping & Delivery", url: "/settings/shipping" },
      { title: "Taxes & Duties", url: "/settings/taxes" },
      { title: "Notifications", url: "/settings/notifications" },
    ],
  },
  { title: "Help", url: "/help", icon: <CircleHelpIcon /> },
];

export function AppSidebar({
  tenantSwitcher,
  user: propUser,
  onLogout,
  LinkComponent,
  ...props
}: AppSidebarProps) {
  const Link = LinkComponent ?? "a";

  const fallbackUser: AppSidebarUser = {
    name: "Admin User",
    email: "admin@example.com",
    avatar: "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {tenantSwitcher && <div className="px-2 pb-2">{tenantSwitcher}</div>}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} LinkComponent={LinkComponent} />
        <NavSecondary
          items={navSecondary}
          LinkComponent={LinkComponent}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={propUser ?? fallbackUser} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: exit 0

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: 131+ tests pass (existing + new)

- [ ] **Step 4: Typecheck admin app**

Run: `pnpm --filter admin typecheck`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/blocks/dashboard/app-sidebar.tsx
git commit -m "feat(admin): populate sidebar with Shopify-style navigation hierarchy"
```

---

### Task 4: Update session context (AGENTS.md)

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

Mark sidebar restructure as complete in the session context.

```bash
git add AGENTS.md
git commit -m "docs: update session context with sidebar restructure"
```
