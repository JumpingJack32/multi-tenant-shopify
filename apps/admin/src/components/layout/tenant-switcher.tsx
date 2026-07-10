"use client";

import { useTenantContext } from "@/contexts/tenant-context";

export function TenantSwitcher() {
  const { currentTenant, tenantList, setTenant, isLoading } =
    useTenantContext();

  if (isLoading || !currentTenant) return null;

  return (
    <div className="space-y-2">
      <select
        value={currentTenant.tenant_id}
        onChange={(e) => setTenant(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
      >
        {tenantList.map((tenant) => (
          <option key={tenant.id} value={tenant.tenant_id}>
            {tenant.name}
          </option>
        ))}
      </select>
      <div className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground truncate">
        {currentTenant.slug}
      </div>
    </div>
  );
}
