import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export function useDispatches(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["dispatches", params, tid],
    queryFn: () => api.marketing.dispatches.list(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useDispatch(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["dispatch", id, tid],
    queryFn: () => api.marketing.dispatches.get(id, { tenantId: tid }),
    enabled: !!id && !!tid,
  });
}

export function useCreateDispatch(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      template_id: string;
      segment_id: string;
      scheduled_at?: string | null;
      send_immediately?: boolean;
    }) => api.marketing.dispatches.create(data, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    },
  });
}

export function useCancelDispatch(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.marketing.dispatches.cancel(id, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    },
  });
}

export function useScheduleDispatch(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      api.marketing.dispatches.schedule(id, scheduledAt, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    },
  });
}
