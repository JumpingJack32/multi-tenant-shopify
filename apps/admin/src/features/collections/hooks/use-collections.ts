import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fetchCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from "../api/collections-service";

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export function useCollections(
  includeInactive?: boolean,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery({
    queryKey: ["collections", { includeInactive }, tid],
    queryFn: () => fetchCollections(includeInactive, tid),
    enabled: !!tid,
  });
}

export function useCreateCollection(tenantId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => createCollection(data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useUpdateCollection(tenantId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateCollection(id, data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useDeleteCollection(tenantId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCollection(id, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
