export function resolveTenantFromHeaders(headers: Headers): string | null {
  const tenantId = headers.get("x-tenant-id");
  if (tenantId) return tenantId;

  const host = headers.get("host");
  if (host) {
    const parts = host.split(".");
    if (parts.length > 1 && parts[0]) {
      return parts[0];
    }
  }

  return null;
}

export function resolveTenantFromClerkToken(token: string): string | null {
  try {
    const parts = token.split(".");
    const payload = parts[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    );
    return decoded.tenant_id ?? decoded.sub ?? null;
  } catch {
    return null;
  }
}

export function resolveTenantFromRequest(req: Request): string | null {
  const tenantId = resolveTenantFromHeaders(req.headers);
  if (tenantId) return tenantId;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return resolveTenantFromClerkToken(authHeader.slice(7));
  }

  return null;
}
