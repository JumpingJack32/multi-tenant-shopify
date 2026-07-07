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

async function fetchDashboardSummary() {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.dashboard.summary({ tenantId });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
  });
}
