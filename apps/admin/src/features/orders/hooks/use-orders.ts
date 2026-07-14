import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssociatedPO,
  Order,
  OrderListResponse,
} from "@repo/tenant-orm/types";

import {
  fetchOrder,
  fetchOrderLinkedPOs,
  fetchOrders,
  updateOrderStatus,
} from "../api/orders-service";

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

export function useOrders(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<OrderListResponse>({
    queryKey: ["orders", params, tid],
    queryFn: () => fetchOrders(params, tid),
    enabled: !!tid,
  });
}

export function useOrder(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<Order>({
    queryKey: ["order", id, tid],
    queryFn: () => fetchOrder(id, tid),
    enabled: !!tid && !!id,
  });
}

export function useUpdateOrderStatus(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateOrderStatus(id, data, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useOrderLinkedPOs(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<AssociatedPO[]>({
    queryKey: ["order-linked-pos", id, tid],
    queryFn: () => fetchOrderLinkedPOs(id, tid),
    enabled: !!tid && !!id,
  });
}
