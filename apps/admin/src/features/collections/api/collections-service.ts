import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export async function fetchCollections(includeInactive?: boolean) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  const params: Record<string, string> = {};
  if (includeInactive !== undefined) {
    params.include_inactive = String(includeInactive);
  }
  return api.collections.list(params, { tenantId });
}

export async function createCollection(data: unknown) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.collections.create(data, { tenantId });
}

export async function updateCollection(id: string, data: unknown) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.collections.update(id, data, { tenantId });
}

export async function deleteCollection(id: string) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.collections.delete(id, { tenantId });
}
