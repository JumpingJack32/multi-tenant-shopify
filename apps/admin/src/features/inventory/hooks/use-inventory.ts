import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InventoryItem } from "@repo/tenant-orm/types";

import {
  fetchInventoryItems,
  fetchInventoryStats,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../api/inventory-service";

interface InventoryQueryParams {
  q?: string;
  category?: string;
  status?: string;
  page?: string;
  page_size?: string;
  sort_by?: string;
  sort_order?: string;
}

export function useInventoryItems(
  params?: InventoryQueryParams,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery({
    queryKey: ["inventory", "items", params, tid],
    queryFn: () => fetchInventoryItems(params ?? {}, tid),
    enabled: !!tid,
  });
}

export function useInventoryStats(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery({
    queryKey: ["inventory", "stats", tid],
    queryFn: () => fetchInventoryStats(tid),
    enabled: !!tid,
  });
}

export function useCreateInventoryItem(tenantId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      createInventoryItem(data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateInventoryItem(tenantId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateInventoryItem(id, data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteInventoryItem(tenantId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
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
