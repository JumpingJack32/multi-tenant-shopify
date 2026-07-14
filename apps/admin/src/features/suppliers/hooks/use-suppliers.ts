import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Supplier, SupplierListResponse } from "@repo/tenant-orm/types";

import {
  createSupplier,
  deleteSupplier,
  fetchSupplier,
  fetchSuppliers,
  updateSupplier,
} from "../api/suppliers-service";

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    return (
      (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem(
        "admin_selected_tenant",
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function useSuppliers(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<SupplierListResponse>({
    queryKey: ["suppliers", params, tid],
    queryFn: () => fetchSuppliers(params, tid),
    enabled: !!tid,
  });
}

export function useSupplier(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<Supplier>({
    queryKey: ["supplier", id, tid],
    queryFn: () => fetchSupplier(id, tid),
    enabled: !!tid && !!id,
  });
}

export function useCreateSupplier(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createSupplier(data, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useUpdateSupplier(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateSupplier(id, data, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useDeleteSupplier(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}
