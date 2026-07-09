import { api } from "@/lib/api/client";

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export async function fetchCollections(
  includeInactive?: boolean,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  const params: Record<string, string> = {};
  if (includeInactive !== undefined) {
    params.include_inactive = String(includeInactive);
  }
  return api.collections.list(params, { tenantId: tid });
}

export async function createCollection(
  data: unknown,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.collections.create(data, { tenantId: tid });
}

export async function updateCollection(
  id: string,
  data: unknown,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.collections.update(id, data, { tenantId: tid });
}

export async function deleteCollection(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.collections.delete(id, { tenantId: tid });
}
