export function resolveTenantFromRequest(req: Request): string | null {
  const host = req.headers.get("host");
  if (host) {
    const parts = host.split(".");
    if (parts.length > 1) {
      return parts[0];
    }
  }

  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");
  if (tenant) return tenant;

  return null;
}
