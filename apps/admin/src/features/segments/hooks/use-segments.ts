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

export function useSegments(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["segments", tid],
    queryFn: () => api.segments.list({ tenantId: tid }),
    enabled: !!tid,
  });
}
