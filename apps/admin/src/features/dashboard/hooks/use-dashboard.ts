import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "@repo/tenant-orm/types";

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

export function useDashboard(tenantId?: string | null, period: string = "30d") {
  const tid = tenantId ?? getTenantId();
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary", period, tid],
    queryFn: () => api.dashboard.summary({ tenantId: tid, period }),
    enabled: !!tid,
  });
}
