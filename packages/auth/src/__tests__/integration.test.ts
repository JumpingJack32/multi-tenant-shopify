import { describe, it, expect } from "vitest";

function extractTenantFromToken(token: string): string | null {
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

describe("auth + tenant data isolation flow", () => {
  it("extracts tenant_id from a Clerk JWT-like token", () => {
    const payload = Buffer.from(
      JSON.stringify({ tenant_id: "tenant-789" }),
    ).toString("base64url");
    const token = `header.${payload}.signature`;

    const tenantId = extractTenantFromToken(token);
    expect(tenantId).toBe("tenant-789");
  });

  it("falls back to sub claim when tenant_id is absent", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "user-456" })).toString(
      "base64url",
    );
    const token = `header.${payload}.signature`;

    const tenantId = extractTenantFromToken(token);
    expect(tenantId).toBe("user-456");
  });

  it("returns null for malformed token", () => {
    const tenantId = extractTenantFromToken("not-a-valid-token");
    expect(tenantId).toBeNull();
  });

  it("returns null when payload part is empty", () => {
    const tenantId = extractTenantFromToken("header..signature");
    expect(tenantId).toBeNull();
  });

  it("prioritizes tenant_id over sub claim", () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        tenant_id: "tenant-999",
      }),
    ).toString("base64url");
    const token = `header.${payload}.signature`;

    const tenantId = extractTenantFromToken(token);
    expect(tenantId).toBe("tenant-999");
  });
});
