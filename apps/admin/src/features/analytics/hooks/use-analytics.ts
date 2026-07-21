import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export function useTopProducts(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "top-products", params, tid],
    queryFn: () => api.analytics.topProducts(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCategoryBreakdown(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "category-breakdown", params, tid],
    queryFn: () => api.analytics.categoryBreakdown(params, { tenantId: tid }),
    enabled: !!tid,
  });
}
