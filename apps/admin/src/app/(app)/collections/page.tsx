"use client";

import { CollectionsTable } from "@/components/collections/collections-table";
import { useTenantContext } from "@/contexts/tenant-context";

export default function CollectionsPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-muted-foreground">Manage product collections</p>
      </div>
      <CollectionsTable
        tenantId={currentTenantId}
        tenantLoading={tenantLoading}
      />
    </div>
  );
}
