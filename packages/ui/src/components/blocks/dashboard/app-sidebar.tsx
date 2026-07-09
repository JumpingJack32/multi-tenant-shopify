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
