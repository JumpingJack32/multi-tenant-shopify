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

export function useCampaignTemplates(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["campaign-templates", tid],
    queryFn: () => api.marketing.templates.list({ tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCampaignTemplate(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["campaign-template", id, tid],
    queryFn: () => api.marketing.templates.get(id, { tenantId: tid }),
    enabled: !!id && !!tid,
  });
}

export function useCreateCampaignTemplate(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.marketing.templates.create(data, { tenantId: tid }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["campaign-templates"] }),
  });
}

export function useUpdateCampaignTemplate(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.marketing.templates.update(id, data, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-templates"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-template"] });
    },
  });
}

export function useDeleteCampaignTemplate(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.marketing.templates.delete(id, { tenantId: tid }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["campaign-templates"] }),
  });
}
