import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    return (globalThis as any).sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export function useDashboardMetrics(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["dashboard", "metrics", tid],
    queryFn: () => api.dashboard.metrics({ tenantId: tid }),
    enabled: !!tid,
    refetchInterval: 60_000,
  });
}
