"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppSidebarUser } from "@repo/ui/components/blocks/dashboard/app-sidebar";
import { AppSidebar } from "@repo/ui/components/blocks/dashboard/app-sidebar";
import { SiteHeader } from "@repo/ui/components/blocks/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { NotificationBell } from "@/components/layout/notification-bell";
import { SuperuserTenantSwitcher } from "@/components/layout/superuser-tenant-switcher";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import { RbacProvider } from "@/contexts/rbac-context";
import { TenantProvider } from "@/contexts/tenant-context";

const queryClient = new QueryClient();

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/collections": "Collections",
  "/categories": "Categories",
  "/customers": "Customers",
  "/orders": "Orders",
  "/settings": "Settings",
};

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const title =
    Object.entries(pageTitles).find(([path]) =>
      pathname?.startsWith(path),
    )?.[1] ?? "Dashboard";

  const sidebarUser: AppSidebarUser = {
    name: user?.fullName ?? user?.username ?? "Admin User",
    email: user?.primaryEmailAddress?.emailAddress ?? "admin@example.com",
    avatar: user?.imageUrl ?? null,
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        tenantSwitcher={<TenantSwitcher />}
        user={sidebarUser}
        onLogout={() => signOut({ redirectUrl: "/auth/sign-in" })}
        LinkComponent={Link}
      />
      <SidebarInset>
        <SiteHeader title={title} rightContent={<><SuperuserTenantSwitcher /><NotificationBell /></>} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <RbacProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </RbacProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
}
