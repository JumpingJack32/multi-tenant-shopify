import { describe, it, expect } from "vitest";
import { resolveTenantFromRequest } from "../tenant-resolver";

function makeRequest(url: string, host?: string): Request {
  const headers: Record<string, string> = {};
  if (host !== undefined) {
    headers.host = host;
  }
  return new Request(url, { headers });
}

describe("resolveTenantFromRequest", () => {
  it("extracts tenant from subdomain", () => {
    const req = makeRequest("https://example.com/products", "acme.example.com");
    expect(resolveTenantFromRequest(req)).toBe("acme");
  });

  it("extracts tenant from second-level subdomain", () => {
    const req = makeRequest("https://myapp.com/products", "shop.myapp.com");
    expect(resolveTenantFromRequest(req)).toBe("shop");
  });

  it("extracts tenant from query param when host has single part", () => {
    const req = makeRequest(
      "http://localhost/products?tenant=my-shop",
      "localhost",
    );
    expect(resolveTenantFromRequest(req)).toBe("my-shop");
  });

  it("returns null when no tenant can be resolved", () => {
    const req = makeRequest("http://localhost/products", "localhost");
    expect(resolveTenantFromRequest(req)).toBeNull();
  });

  it("returns null for missing host header", () => {
    const req = makeRequest("http://localhost/test", "");
    expect(resolveTenantFromRequest(req)).toBeNull();
  });
});
