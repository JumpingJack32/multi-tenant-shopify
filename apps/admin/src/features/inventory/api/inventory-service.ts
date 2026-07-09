import type { InventoryItem } from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

interface InventoryParams {
  q?: string;
  category?: string;
  status?: string;
  page?: string;
  page_size?: string;
  sort_by?: string;
  sort_order?: string;
}

export async function fetchInventoryItems(
  params: InventoryParams,
  tenantId?: string | null,
): Promise<{ data: InventoryItem[]; total: number }> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) return { data: [], total: 0 };

  const q: Record<string, string> = {};
  if (params.q) q.q = params.q;
  if (params.category) q.category = params.category;
  if (params.status) q.status = params.status;
  if (params.page) q.page = params.page;
  if (params.page_size) q.page_size = params.page_size;
  if (params.sort_by) q.sort_by = params.sort_by;
  if (params.sort_order) q.sort_order = params.sort_order;

  const result = await api.inventory.list(q, { tenantId: tid });

  return {
    data: result.data,
    total: result.pagination.total,
  };
}

export async function fetchInventoryStats(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) {
    return {
      total_skus: 0,
      total_value: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
    };
  }
  return api.inventory.stats({ tenantId: tid });
}

export async function createInventoryItem(
  data: Record<string, unknown>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.inventory.create(data, { tenantId: tid });
}

export async function updateInventoryItem(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.inventory.update(id, data, { tenantId: tid });
}

export async function deleteInventoryItem(
  id: string,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.inventory.delete(id, { tenantId: tid });
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
