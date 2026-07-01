import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProducts } from "../use-products";
import type { ReactNode } from "react";

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
    const mockProducts = [
      { id: "1", name: "Product A", slug: "product-a", status: "published" },
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
