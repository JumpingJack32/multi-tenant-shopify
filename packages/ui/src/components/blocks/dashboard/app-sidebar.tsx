"use client";

import type { ElementType } from "react";

import { NavMain, type NavItem } from "./nav-main";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@repo/ui/components/ui/sidebar";
import {
  BanknoteIcon,
  BarChart3Icon,
  CircleHelpIcon,
  CommandIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  Settings2Icon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
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
  avatar: string | null;
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  tenantSwitcher?: React.ReactNode;
  user?: AppSidebarUser;
  onLogout?: () => void;
  LinkComponent?: ElementType;
}

// ─── TOP ZONE: Quick Navigation & Daily Pulse ─────────────────────────
const navTop: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
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
];

// ─── MIDDLE ZONE: Management ──────────────────────────────────────────
const navManagement: NavItem[] = [
  {
    title: "Products",
    icon: <PackageIcon />,
    url: "/products/getting-started",
    items: [
      { title: "All Products", url: "/products" },
      { title: "Collections", url: "/collections" },
      { title: "Inventory", url: "/products/inventory" },
      { title: "Stock Levels", url: "/products/inventory/stock" },
      { title: "Warehouses", url: "/products/inventory/nodes" },
      { title: "Stock Transfers", url: "/products/inventory/transfers" },
    ],
  },
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
  { title: "Orders", url: "/orders", icon: <ReceiptIcon /> },
  { title: "Customers", url: "/customers", icon: <UsersIcon /> },
];

// ─── MIDDLE ZONE: Procurement ──────────────────────────────────────────
const navProcurement: NavItem[] = [
  { title: "Purchase Orders", url: "/purchase-orders", icon: <FileTextIcon /> },
  { title: "Suppliers", url: "/suppliers", icon: <TruckIcon /> },
];

// ─── MIDDLE ZONE: Commerce & Revenue ──────────────────────────────────
const navCommerce: NavItem[] = [
  {
    title: "Sales Channels",
    icon: <StoreIcon />,
    items: [
      { title: "Online Store", url: "/sales-channel/online-store" },
      { title: "Navigation", url: "/navigation" },
      { title: "Point of Sale", url: "/sales-channel/pos" },
      { title: "Shop", url: "/sales-channel/shop" },
    ],
  },
  {
    title: "Marketing",
    icon: <MegaphoneIcon />,
    items: [
      { title: "Campaigns", url: "/marketing/campaigns" },
      { title: "Dispatches", url: "/marketing/dispatches" },
      { title: "Automation", url: "/marketing/automation" },
      { title: "Templates", url: "/marketing/templates" },
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
      { title: "Subscriptions", url: "/subscriptions" },
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
];

// ─── BOTTOM ZONE: Low-Frequency / Utility ─────────────────────────────
const navUtility: NavItem[] = [
  {
    title: "Settings",
    icon: <Settings2Icon />,
    items: [
      { title: "General", url: "/settings/general" },
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
    avatar: null,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
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
        {/* TOP ZONE */}
        <NavMain items={navTop} LinkComponent={LinkComponent} />

        {/* MIDDLE ZONE — Management */}
        <NavMain
          items={navManagement}
          label="Management"
          LinkComponent={LinkComponent}
        />

        {/* MIDDLE ZONE — Procurement */}
        <NavMain
          items={navProcurement}
          label="Procurement"
          LinkComponent={LinkComponent}
        />

        {/* MIDDLE ZONE — Commerce & Revenue */}
        <NavMain
          items={navCommerce}
          label="Commerce & Revenue"
          LinkComponent={LinkComponent}
        />

        {/* BOTTOM ZONE — pinned to bottom */}
        <div className="mt-auto">
          <NavMain items={navUtility} LinkComponent={LinkComponent} />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={propUser ?? fallbackUser} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
