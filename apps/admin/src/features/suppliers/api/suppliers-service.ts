import type { Supplier, SupplierListResponse } from "@repo/tenant-orm/types";

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

export async function fetchSuppliers(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<SupplierListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid)
    return {
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    };
  return api.suppliers.list(params, { tenantId: tid });
}

export async function fetchSupplier(
  id: string,
  tenantId?: string | null,
): Promise<Supplier> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.get(id, { tenantId: tid });
}

export async function createSupplier(
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Supplier> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.create(data, { tenantId: tid });
}

export async function updateSupplier(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Supplier> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.update(id, data, { tenantId: tid });
}

export async function deleteSupplier(
  id: string,
  tenantId?: string | null,
): Promise<void> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.delete(id, { tenantId: tid });
}
