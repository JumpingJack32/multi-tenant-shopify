import { useQuery } from "@tanstack/react-query";
import type { CustomerDetail } from "@repo/tenant-orm/types";

import { fetchCustomers, fetchCustomer } from "../api/customers-service";

export function useCustomers(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery({
    queryKey: ["customers", params, tid],
    queryFn: () => fetchCustomers(params, tid),
    enabled: !!tid,
  });
}

export function useCustomer(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery<CustomerDetail>({
    queryKey: ["customer", id, tid],
    queryFn: () => fetchCustomer(id, tid),
    enabled: !!id && !!tid,
  });
}

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}
