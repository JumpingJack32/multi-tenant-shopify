import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Product } from "@repo/tenant-orm/types";

import { useProducts } from "../use-products";

vi.mock("@/lib/api/client", () => ({
  api: {
    products: {
      list: vi.fn(),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useProducts", () => {
  beforeEach(() => {
    sessionStorage.setItem("admin_selected_tenant", "test-tenant-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns products on success", async () => {
    const mockProducts: Product[] = [
      {
        id: "1",
        tenant_id: "tenant-1",
        name: "Product A",
        slug: "product-a",
        description: "A test product",
        sku: "SKU-001",
        status: "published",
        weight: 1.5,
        weight_unit: "kg",
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ];
    const { api } = await import("@/lib/api/client");
    vi.mocked(api.products.list).mockResolvedValue(mockProducts);

    const { result } = renderHook(() => useProducts({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });

  it("handles error state", async () => {
    const { api } = await import("@/lib/api/client");
    vi.mocked(api.products.list).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useProducts({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
