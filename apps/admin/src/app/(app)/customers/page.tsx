"use client";

import { CustomersTable } from "@/components/customers/customers-table";
import { useTenantContext } from "@/contexts/tenant-context";

export default function CustomersPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">View and manage customers</p>
      </div>
      <CustomersTable
        tenantId={currentTenantId}
        tenantLoading={tenantLoading}
      />
    </div>
  );
}
