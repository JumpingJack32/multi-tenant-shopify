import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTenantClient } from "../client";

const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe("createTenantClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a client with the correct URL and key", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createTenantClient("https://supabase.test", "test-key");

    expect(createClient).toHaveBeenCalledWith(
      "https://supabase.test",
      "test-key",
      expect.objectContaining({
        global: { headers: {} },
      }),
    );
  });

  it("initializes with empty tenantId", () => {
    const client = createTenantClient("https://supabase.test", "test-key");
    expect(client.tenantId).toBe("");
  });

  it("withTenantScope includes X-Tenant-ID header", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockClear();

    const client = createTenantClient("https://supabase.test", "test-key");
    client.tenantId = "tenant-456";
    client.withTenantScope();

    expect(createClient).toHaveBeenLastCalledWith(
      "https://supabase.test",
      "test-key",
      expect.objectContaining({
        global: {
          headers: {
            "X-Tenant-ID": "tenant-456",
          },
        },
        auth: { persistSession: false },
      }),
    );
  });

  it("reflects updated tenantId in subsequent withTenantScope calls", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockClear();

    const client = createTenantClient("https://supabase.test", "test-key");

    client.tenantId = "tenant-aaa";
    client.withTenantScope();
    expect(createClient).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        global: { headers: { "X-Tenant-ID": "tenant-aaa" } },
      }),
    );

    client.tenantId = "tenant-bbb";
    client.withTenantScope();
    expect(createClient).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        global: { headers: { "X-Tenant-ID": "tenant-bbb" } },
      }),
    );
  });
});
