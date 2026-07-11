import type {
  AssociatedPO,
  Order,
  OrderListResponse,
} from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

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

export async function fetchOrders(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<OrderListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid)
    return {
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    };
  return api.orders.list(params, { tenantId: tid });
}

export async function fetchOrder(
  id: string,
  tenantId?: string | null,
): Promise<Order> {
  const tid = tenantId ?? getStorageTenantId();
  return api.orders.get(id, { tenantId: tid });
}

export async function updateOrderStatus(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Order> {
  const tid = tenantId ?? getStorageTenantId();
  return api.orders.updateStatus(id, data, { tenantId: tid });
}

export async function fetchOrderLinkedPOs(
  id: string,
  tenantId?: string | null,
): Promise<AssociatedPO[]> {
  const tid = tenantId ?? getStorageTenantId();
  return api.orders.getLinkedPOs(id, { tenantId: tid });
}
