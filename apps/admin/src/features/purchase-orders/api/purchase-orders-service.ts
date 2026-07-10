import type {
  PurchaseOrder,
  PurchaseOrderListResponse,
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

export async function fetchPOs(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<PurchaseOrderListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid)
    return {
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    };
  return api.purchaseOrders.list(params, { tenantId: tid });
}

export async function fetchPO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.get(id, { tenantId: tid });
}

export async function approvePO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.approve(id, { tenantId: tid });
}

export async function cancelPO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.cancel(id, { tenantId: tid });
}

export async function updatePOTracking(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.updateTracking(id, data, { tenantId: tid });
}

export async function confirmPO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.markConfirmed(id, { tenantId: tid });
}

export async function markPOInTransit(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.markInTransit(id, { tenantId: tid });
}

export async function closePO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.markClosed(id, { tenantId: tid });
}

export async function batchApprovePOs(
  ids: string[],
  tenantId?: string | null,
): Promise<{ approved: number }> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.batchApprove(ids, { tenantId: tid });
}
