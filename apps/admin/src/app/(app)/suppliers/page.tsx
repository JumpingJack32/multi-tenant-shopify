"use client";

import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { useTenantContext } from "@/contexts/tenant-context";

export default function SuppliersPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">Manage your product suppliers</p>
        </div>
      </div>
      <SuppliersTable
        tenantId={currentTenantId}
        tenantLoading={tenantLoading}
      />
    </div>
  );
}
