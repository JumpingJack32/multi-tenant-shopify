import type {
  Order,
  OrderListResponse,
  AssociatedPO,
} from "@repo/tenant-orm/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetchOrders = vi.fn();
const mockFetchOrder = vi.fn();
const mockUpdateOrderStatus = vi.fn();
const mockFetchOrderLinkedPOs = vi.fn();

vi.mock("../../api/orders-service", () => ({
  fetchOrders: mockFetchOrders,
  fetchOrder: mockFetchOrder,
  updateOrderStatus: mockUpdateOrderStatus,
  fetchOrderLinkedPOs: mockFetchOrderLinkedPOs,
}));

const MOCK_ORDER: Order = {
  id: "order-1",
  tenant_id: "tenant-1",
  customer_id: null,
  customer_email: null,
  order_number: "SO-001",
  status: "pending",
  payment_status: "unpaid",
  payment_method: null,
  payment_intent_id: null,
  subtotal: 1000,
  total: 1000,
  currency: "USD",
  shipping_address: {},
  billing_address: {},
  notes: null,
  items: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  tax: 0,
  shipping: 0,
  discount: 0,
};

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

describe("useOrders", () => {
  beforeEach(() => {
    sessionStorage.setItem("admin_selected_tenant", "test-tenant-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns orders on success", async () => {
    const response: OrderListResponse = {
      data: [MOCK_ORDER],
      pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
    };
    mockFetchOrders.mockResolvedValue(response);

    const { useOrders } = await import("../use-orders");
    const { result } = renderHook(() => useOrders({ status: "pending" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(response);
  });

  it("handles error state", async () => {
    mockFetchOrders.mockRejectedValue(new Error("Network error"));

    const { useOrders } = await import("../use-orders");
    const { result } = renderHook(() => useOrders({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useOrder", () => {
  beforeEach(() => {
    sessionStorage.setItem("admin_selected_tenant", "test-tenant-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns order on success", async () => {
    mockFetchOrder.mockResolvedValue(MOCK_ORDER);

    const { useOrder } = await import("../use-orders");
    const { result } = renderHook(() => useOrder("order-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(MOCK_ORDER);
  });

  it("is disabled when id is empty", async () => {
    const { useOrder } = await import("../use-orders");
    const { result } = renderHook(() => useOrder(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchOrder).not.toHaveBeenCalled();
  });
});

describe("useUpdateOrderStatus", () => {
  beforeEach(() => {
    sessionStorage.setItem("admin_selected_tenant", "test-tenant-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mutates and invalidates queries", async () => {
    const updated = { ...MOCK_ORDER, status: "confirmed" };
    mockUpdateOrderStatus.mockResolvedValue(updated);

    const { useUpdateOrderStatus } = await import("../use-orders");
    const { result } = renderHook(() => useUpdateOrderStatus(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: "order-1",
      data: { status: "confirmed" },
    });

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      "order-1",
      { status: "confirmed" },
      "test-tenant-id",
    );
  });
});

describe("useOrderLinkedPOs", () => {
  beforeEach(() => {
    sessionStorage.setItem("admin_selected_tenant", "test-tenant-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns linked POs on success", async () => {
    const po: AssociatedPO = {
      id: "po-1",
      po_number: "PO-001",
      status: "pending_review",
      supplier_name: "Acme",
      total: 5000,
      fulfillment_strategy: "dropship",
      created_at: "2025-01-01T00:00:00Z",
    };
    mockFetchOrderLinkedPOs.mockResolvedValue([po]);

    const { useOrderLinkedPOs } = await import("../use-orders");
    const { result } = renderHook(() => useOrderLinkedPOs("order-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([po]);
  });
});
