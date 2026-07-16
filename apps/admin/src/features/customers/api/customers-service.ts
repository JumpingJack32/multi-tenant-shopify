import type {
  Customer,
  CustomerDetail,
  CustomerListResponse,
  CustomerMetrics,
  StoreCreditResponse,
  StoreCreditTransaction,
  TimelineEvent,
} from "@repo/tenant-orm/types";

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

export async function fetchCustomers(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<CustomerListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.list(params, { tenantId: tid });
}

export async function fetchCustomer(
  id: string,
  tenantId?: string | null,
): Promise<CustomerDetail> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.get(id, { tenantId: tid });
}

export async function createCustomer(
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Customer> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.create(data, { tenantId: tid });
}

export async function updateCustomer(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Customer> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.update(id, data, { tenantId: tid });
}

export async function deleteCustomer(
  id: string,
  tenantId?: string | null,
): Promise<void> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.delete(id, { tenantId: tid });
}

export async function fetchCustomerMetrics(
  tenantId?: string | null,
): Promise<CustomerMetrics> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.getMetrics({ tenantId: tid });
}

export async function fetchCustomerTimeline(
  id: string,
  tenantId?: string | null,
): Promise<TimelineEvent[]> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.getTimeline(id, { tenantId: tid });
}

export async function addCustomerTimelineEvent(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<TimelineEvent> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.addTimelineEvent(id, data, { tenantId: tid });
}

export async function fetchCustomerCredit(
  id: string,
  tenantId?: string | null,
): Promise<StoreCreditResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.getCredit(id, { tenantId: tid });
}

export async function addCustomerCredit(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<StoreCreditTransaction> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.addCredit(id, data, { tenantId: tid });
}

export async function exportCustomersCsv(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<Blob> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.exportCsv(params, { tenantId: tid });
}

export async function importCustomersCsv(
  file: File,
  tenantId?: string | null,
): Promise<{
  total: number;
  imported: number;
  errors: Array<Record<string, unknown>>;
}> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.customers.importCsv(file, { tenantId: tid });
}
