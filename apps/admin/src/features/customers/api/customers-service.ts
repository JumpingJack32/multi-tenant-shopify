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

export async function fetchCustomers(params?: Record<string, string>) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.customers.list(params, { tenantId });
}

export async function fetchCustomer(id: string) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.customers.get(id, { tenantId });
}
