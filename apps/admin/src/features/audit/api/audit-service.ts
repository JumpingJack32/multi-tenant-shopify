import { request } from "@/lib/api/client";

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditFilters {
  action?: string;
  actor_email?: string;
  resource_type?: string;
  resource_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface AuditPage {
  data: AuditLogEntry[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

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

function resolveTenant(tenantId?: string | null): string | null {
  return tenantId ?? getStorageTenantId();
}

function buildQuery(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.actor_email) params.set("actor_email", filters.actor_email);
  if (filters.resource_type) params.set("resource_type", filters.resource_type);
  if (filters.resource_id) params.set("resource_id", filters.resource_id);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return params;
}

export async function fetchAuditLogs(
  filters: AuditFilters,
  page: number,
  pageSize = 50,
  tenantId?: string | null,
): Promise<AuditPage> {
  const tid = resolveTenant(tenantId);
  if (!tid) {
    return { data: [], pagination: { page, page_size: pageSize, total: 0, total_pages: 1 } };
  }
  const params = buildQuery(filters);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return request<AuditPage>(`/admin/audit-logs?${params.toString()}`, {
    tenantId: tid,
  });
}

export async function exportAuditLogs(
  filters: AuditFilters,
  tenantId?: string | null,
): Promise<void> {
  const tid = resolveTenant(tenantId);
  if (!tid) return;
  const params = buildQuery(filters);
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/admin/audit-logs/export?${params.toString()}`;
  const res = await fetch(url, {
    headers: tid ? { "X-Tenant-ID": tid } : undefined,
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
