"use client";

import { useAuth, UserButton, SignOutButton } from "@clerk/nextjs";
import { useTenantContext } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";

export default function Header() {
  const { isSignedIn } = useAuth();
  const { currentTenant } = useTenantContext();
  const { role } = useRbac();

  if (!isSignedIn) return null;

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
          <SignOutButton>
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </SignOutButton>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
