"use client";

import { use } from "react";

import { CustomerProfile } from "@/components/customers/customer-profile";
import { useTenantContext } from "@/contexts/tenant-context";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { currentTenantId } = useTenantContext();
  return (
    <div className="p-6">
      <CustomerProfile customerId={id} tenantId={currentTenantId} />
    </div>
  );
}
