import { describe, it, expect } from "vitest";
import { resolveTenantFromRequest } from "../tenant-resolver";

describe("resolveTenantFromRequest", () => {
  it("extracts tenant from x-tenant-id header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-tenant-id": "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(resolveTenantFromRequest(req)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("extracts tenant from host subdomain", () => {
    const req = new Request("http://acme.localhost");
    req.headers.set("host", "acme.localhost");
    expect(resolveTenantFromRequest(req)).toBe("acme");
  });

  it("returns null when no tenant context found", () => {
    const req = new Request("http://localhost");
    expect(resolveTenantFromRequest(req)).toBeNull();
  });

  it("extracts tenant from Bearer token claims", () => {
    const payload = Buffer.from(
      JSON.stringify({ tenant_id: "tenant-123" }),
    ).toString("base64url");
    const req = new Request("http://localhost", {
      headers: { authorization: `Bearer header.${payload}.sig` },
    });
    expect(resolveTenantFromRequest(req)).toBe("tenant-123");
  });
});
