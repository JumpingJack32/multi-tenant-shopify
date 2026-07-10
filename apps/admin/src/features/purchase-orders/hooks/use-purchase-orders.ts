import type {
  PurchaseOrder,
  PurchaseOrderListResponse,
} from "@repo/tenant-orm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approvePO,
  batchApprovePOs,
  cancelPO,
  closePO,
  confirmPO,
  fetchPO,
  fetchPOs,
  markPOInTransit,
  updatePOTracking,
} from "../api/purchase-orders-service";

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

export function usePurchaseOrders(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<PurchaseOrderListResponse>({
    queryKey: ["purchaseOrders", params, tid],
    queryFn: () => fetchPOs(params, tid),
    enabled: !!tid,
  });
}

export function usePurchaseOrder(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<PurchaseOrder>({
    queryKey: ["purchaseOrder", id, tid],
    queryFn: () => fetchPO(id, tid),
    enabled: !!tid && !!id,
  });
}

export function useApprovePO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => approvePO(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useCancelPO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => cancelPO(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useUpdatePOTracking(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updatePOTracking(id, data, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useConfirmPO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => confirmPO(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useMarkPOInTransit(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => markPOInTransit(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useClosePO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => closePO(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useBatchApprovePOs(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (ids: string[]) => batchApprovePOs(ids, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}
