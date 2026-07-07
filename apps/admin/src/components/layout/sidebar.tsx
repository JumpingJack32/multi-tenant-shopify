"use client";

import { cn } from "@repo/shared-utils/cn";
import { Popover } from "@repo/ui/base-ui";
import { Collapsible } from "@repo/ui/base-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

import { useTenantContext } from "@/contexts/tenant-context";

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      {
        label: "Products",
        href: "/products",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        ),
      },
      {
        label: "Categories",
        href: "/categories",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        ),
      },
      {
        label: "Orders",
        href: "/orders",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ),
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { currentTenant, tenantList, setTenant, isLoading } =
    useTenantContext();

  const isActive = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/";
      return pathname?.startsWith(href) ?? false;
    },
    [pathname],
  );

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent",
        )}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };

  if (isLoading) {
    return (
      <aside className="flex h-screen w-64 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-6">
          <span className="font-semibold">Admin</span>
        </div>
        <div className="flex items-center justify-center p-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <span className="font-semibold">Admin</span>
      </div>

      {/* Tenant Switcher */}
      <div className="border-b p-4">
        <Popover.Root>
          <Popover.Trigger className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            <span className="truncate font-medium">
              {currentTenant?.name ?? "Select tenant"}
            </span>
            <svg
              className="w-4 h-4 shrink-0 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Positioner sideOffset={4} align="start">
              <Popover.Popup className="w-[var(--popover-trigger-width)] rounded-lg border bg-popover p-1 shadow-lg">
                {tenantList.map((tenant) => (
                  <Popover.Close key={tenant.id}>
                    <div
                      className={cn(
                        "flex w-full items-center rounded-md px-3 py-2 text-sm",
                        currentTenant?.id === tenant.id
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent",
                      )}
                      onClick={() => setTenant(tenant.id)}
                    >
                      {tenant.name}
                    </div>
                  </Popover.Close>
                ))}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        {currentTenant && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span className="truncate">{currentTenant.slug}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {navSections.map((section) => (
          // Using Base UI Collapsible instead of manual state
          <Collapsible.Root
            key={section.title}
            defaultOpen
            className="mb-2 group"
          >
            <Collapsible.Trigger className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              {section.title}
              <svg
                className="w-3 h-3 transition-transform group-data-[state=closed]:-rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Collapsible.Trigger>

            <Collapsible.Panel className="mt-1 space-y-0.5">
              {section.items.map(renderNavItem)}
            </Collapsible.Panel>
          </Collapsible.Root>
        ))}
      </nav>
    </aside>
  );
}
