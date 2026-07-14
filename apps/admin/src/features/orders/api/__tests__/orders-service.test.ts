import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Order, AssociatedPO } from "@repo/tenant-orm/types";

const mockList = vi.fn();
const mockGet = vi.fn();
const mockUpdateStatus = vi.fn();
const mockGetLinkedPOs = vi.fn();

vi.mock("@/lib/api/client", () => ({
  api: {
    orders: {
      list: mockList,
      get: mockGet,
      updateStatus: mockUpdateStatus,
      getLinkedPOs: mockGetLinkedPOs,
    },
  },
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

describe("orders-service", () => {
  beforeEach(() => {
    sessionStorage.setItem("admin_selected_tenant", "test-tenant-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("fetchOrders returns OrderListResponse", async () => {
    mockList.mockResolvedValue([MOCK_ORDER]);

    const { fetchOrders } = await import("../orders-service");
    const result = await fetchOrders({ status: "pending" });
    expect(result).toEqual({
      data: [MOCK_ORDER],
      pagination: { page: 1, page_size: 1, total: 1, total_pages: 1 },
    });
    expect(mockList).toHaveBeenCalledWith(
      { status: "pending" },
      { tenantId: "test-tenant-id" },
    );
  });

  it("fetchOrders returns empty when no tenant", async () => {
    sessionStorage.clear();
    const { fetchOrders } = await import("../orders-service");
    const result = await fetchOrders();
    expect(result).toEqual({
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    });
  });

  it("fetchOrder returns a single order", async () => {
    mockGet.mockResolvedValue(MOCK_ORDER);

    const { fetchOrder } = await import("../orders-service");
    const result = await fetchOrder("order-1");
    expect(result).toEqual(MOCK_ORDER);
    expect(mockGet).toHaveBeenCalledWith("order-1", {
      tenantId: "test-tenant-id",
    });
  });

  it("updateOrderStatus returns updated order", async () => {
    const updated = { ...MOCK_ORDER, status: "confirmed" };
    mockUpdateStatus.mockResolvedValue(updated);

    const { updateOrderStatus } = await import("../orders-service");
    const result = await updateOrderStatus("order-1", {
      status: "confirmed",
    });
    expect(result).toEqual(updated);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "order-1",
      { status: "confirmed" },
      { tenantId: "test-tenant-id" },
    );
  });

  it("fetchOrderLinkedPOs returns POs", async () => {
    const po: AssociatedPO = {
      id: "po-1",
      po_number: "PO-001",
      status: "pending_review",
      supplier_name: "Acme",
      total: 5000,
      fulfillment_strategy: "dropship",
      created_at: "2025-01-01T00:00:00Z",
    };
    mockGetLinkedPOs.mockResolvedValue([po]);

    const { fetchOrderLinkedPOs } = await import("../orders-service");
    const result = await fetchOrderLinkedPOs("order-1");
    expect(result).toEqual([po]);
    expect(mockGetLinkedPOs).toHaveBeenCalledWith("order-1", {
      tenantId: "test-tenant-id",
    });
  });
});
