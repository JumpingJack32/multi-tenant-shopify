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
  FolderIcon,
  UsersIcon,
  ShoppingCartIcon,
  Settings2Icon,
  CircleHelpIcon,
  CommandIcon,
  TagIcon,
} from "@repo/ui/icons";

export interface SidebarNavItem {
  title: string;
  url: string;
  icon: React.ReactNode;
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
  { title: "Products", url: "/products", icon: <PackageIcon /> },
  { title: "Collections", url: "/collections", icon: <FolderIcon /> },
  { title: "Categories", url: "/categories", icon: <TagIcon /> },
  { title: "Customers", url: "/customers", icon: <UsersIcon /> },
  { title: "Orders", url: "/orders", icon: <ShoppingCartIcon /> },
];

const navSecondary: SidebarNavItem[] = [
  { title: "Settings", url: "/settings", icon: <Settings2Icon /> },
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
