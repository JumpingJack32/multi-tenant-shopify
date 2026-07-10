"use client";

import { POSTable } from "@/components/purchase-orders/pos-table";
import { useTenantContext } from "@/contexts/tenant-context";

export default function PurchaseOrdersPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage your purchase orders</p>
        </div>
      </div>
      <POSTable tenantId={currentTenantId} tenantLoading={tenantLoading} />
    </div>
  );
}
