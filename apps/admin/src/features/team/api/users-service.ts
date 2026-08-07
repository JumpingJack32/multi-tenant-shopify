import { request } from "@/lib/api/client";

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  is_active: boolean;
  is_platform_superuser: boolean;
  invited_at?: string | null;
  last_login_at?: string | null;
}

export interface InvitePayload {
  email: string;
  role: string;
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

export async function fetchTeam(
  tenantId?: string | null,
): Promise<TeamMember[]> {
  const tid = resolveTenant(tenantId);
  if (!tid) return [];
  try {
    return await request<TeamMember[]>("/admin/users", { tenantId: tid });
  } catch {
    return [];
  }
}

export async function inviteUser(
  payload: InvitePayload,
  tenantId?: string | null,
): Promise<TeamMember> {
  const tid = resolveTenant(tenantId);
  return request<TeamMember>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    tenantId: tid,
  });
}

export async function updateUser(
  id: string,
  patch: { role?: string; status?: string; is_active?: boolean },
  tenantId?: string | null,
): Promise<TeamMember> {
  const tid = resolveTenant(tenantId);
  return request<TeamMember>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { "Content-Type": "application/json" },
    tenantId: tid,
  });
}

export async function removeUser(
  id: string,
  tenantId?: string | null,
): Promise<void> {
  const tid = resolveTenant(tenantId);
  await request(`/admin/users/${id}`, {
    method: "DELETE",
    tenantId: tid,
  });
}

export async function transferOwnership(
  id: string,
  tenantId?: string | null,
): Promise<TeamMember> {
  const tid = resolveTenant(tenantId);
  return request<TeamMember>(`/admin/users/${id}/transfer-ownership`, {
    method: "POST",
    tenantId: tid,
  });
}
