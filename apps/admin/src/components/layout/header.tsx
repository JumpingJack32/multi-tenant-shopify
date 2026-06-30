"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { Menu, Popover, Separator } from "@repo/ui/base-ui";
import { useTenantContext } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";

export default function Header() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { currentTenant } = useTenantContext();
  const { role } = useRbac();

  if (!isSignedIn) return null;

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="border-b bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900">Admin</span>
          {currentTenant && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {currentTenant.name}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {role}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Menu.Root>
            <Menu.Trigger className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              <span>Logout</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Menu.Trigger>

            <Menu.Portal>
              <Menu.Positioner sideOffset={4}>
                <Menu.Popup className="w-48 rounded-lg border bg-white p-1 shadow-lg">
                  <Menu.Item
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    onSelect={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>

          <Separator orientation="vertical" className="h-6 w-px bg-gray-200" />

          <Popover.Root>
            <Popover.Trigger className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-medium text-white">
                {initials}
              </div>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Positioner sideOffset={4} align="end">
                <Popover.Popup className="w-64 rounded-lg border bg-white p-1 shadow-lg">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    {user?.emailAddresses?.[0]?.emailAddress && (
                      <p className="truncate text-xs text-gray-500">
                        {user.emailAddresses[0].emailAddress}
                      </p>
                    )}
                  </div>
                  <Separator className="my-1 bg-gray-100" />
                  <div className="p-1">
                    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {role}
                    </div>
                    {currentTenant && (
                      <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {currentTenant.name}
                      </div>
                    )}
                  </div>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </header>
  );
}
