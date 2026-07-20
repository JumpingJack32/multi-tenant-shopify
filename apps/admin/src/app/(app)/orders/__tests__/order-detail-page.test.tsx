import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  useOrder,
  useOrderLinkedPOs,
  useUpdateOrderStatus,
} from "@/features/orders/hooks/use-orders";

import { OrderDetailContent } from "../[id]/order-detail-content";

vi.mock("@/features/orders/hooks/use-orders", () => ({
  useOrder: vi.fn(),
  useOrderLinkedPOs: vi.fn(),
  useUpdateOrderStatus: vi.fn(),
}));

vi.mock("@/contexts/tenant-context", () => ({
  useTenantContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const stubOrder = {
  id: "ord-001",
  order_number: "SO-001",
  status: "pending",
  payment_status: "unpaid",
  payment_method: null,
  currency: "GBP",
  subtotal: 2000,
  tax: 400,
  shipping: 500,
  discount: 0,
  total: 2900,
  customer_email: "buyer@test.com",
  notes: "Please deliver after 5pm",
  created_at: "2026-07-01T10:00:00Z",
  items: [
    {
      id: "item-1",
      product_name: "Widget",
      sku: "WDG-001",
      variant_name: "Small",
      quantity: 2,
      unit_price: 1000,
      total_price: 2000,
    },
  ],
};

const stubPOs = [
  {
    id: "po-001",
    po_number: "PO-001",
    supplier_name: "Acme Supplies",
    status: "pending",
    total: 1500,
  },
];

function mockUseOrder(overrides: Record<string, unknown> = {}) {
  vi.mocked(useOrder).mockReturnValue({
    data: stubOrder,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useOrder>);
}

function mockUseLinkedPOs(data: unknown = stubPOs) {
  vi.mocked(useOrderLinkedPOs).mockReturnValue({
    data,
  } as unknown as ReturnType<typeof useOrderLinkedPOs>);
}

function mockUseUpdateStatus(overrides: Record<string, unknown> = {}) {
  vi.mocked(useUpdateOrderStatus).mockReturnValue({
    ...overrides,
  } as unknown as ReturnType<typeof useUpdateOrderStatus>);
}

function mockTenant(overrides: Record<string, unknown> = {}) {
  vi.mocked(useTenantContext).mockReturnValue({
    currentTenantId: "tenant-001",
    isLoading: false,
    networkError: false,
    retry: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTenantContext>);
}

describe("OrderDetailContent", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function setupDefault() {
    mockTenant();
    mockUseOrder();
    mockUseLinkedPOs();
    mockUseUpdateStatus();
  }

  it("shows loading skeleton while fetching", () => {
    mockTenant({ isLoading: true });
    mockUseOrder({ isLoading: true, data: undefined });
    mockUseLinkedPOs([]);
    mockUseUpdateStatus();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByTestId("loading-skeleton")).toBeDefined();
  });

  it("shows error banner on fetch error", () => {
    setupDefault();
    mockUseOrder({
      isError: true,
      error: new Error("Network error"),
      data: undefined,
    });
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("Network error")).toBeDefined();
    expect(screen.getByText("Back to Orders")).toBeDefined();
  });

  it("renders order header with order number", () => {
    setupDefault();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("SO-001")).toBeDefined();
  });

  it("renders customer email", () => {
    setupDefault();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText(/buyer@test\.com/)).toBeDefined();
  });

  it("renders order items table", () => {
    setupDefault();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("Widget")).toBeDefined();
    expect(screen.getByText("WDG-001")).toBeDefined();
  });

  it("renders linked POs section when present", () => {
    setupDefault();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("Procurement")).toBeDefined();
    expect(screen.getByText("PO-001")).toBeDefined();
  });

  it("hides linked POs section when empty", () => {
    mockTenant();
    mockUseOrder();
    mockUseLinkedPOs([]);
    mockUseUpdateStatus();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.queryByText("Procurement")).toBeNull();
  });

  it("renders Mark as Paid and Cancel buttons for pending orders", () => {
    setupDefault();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("Mark as Paid")).toBeDefined();
    expect(screen.getByText("Cancel Order")).toBeDefined();
  });

  it("renders Ship Order button for confirmed orders", () => {
    mockTenant();
    mockUseOrder({
      data: { ...stubOrder, status: "confirmed", payment_status: "paid" },
    });
    mockUseLinkedPOs([]);
    mockUseUpdateStatus();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("Ship Order")).toBeDefined();
  });

  it("renders status timeline with Current badge", () => {
    mockTenant();
    mockUseOrder({
      data: { ...stubOrder, status: "paid", payment_status: "paid" },
    });
    mockUseLinkedPOs([]);
    mockUseUpdateStatus();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("Current")).toBeDefined();
  });

  it("renders financial breakdown total", () => {
    setupDefault();
    render(<OrderDetailContent id="ord-001" />);
    expect(screen.getByText("£ 29.00")).toBeDefined();
  });

  it("calls updateStatus when action button clicked", () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockTenant();
    mockUseOrder();
    mockUseLinkedPOs([]);
    mockUseUpdateStatus({ mutateAsync });
    render(<OrderDetailContent id="ord-001" />);
    fireEvent.click(screen.getByText("Mark as Paid"));
    expect(mutateAsync).toHaveBeenCalledWith({
      id: "ord-001",
      data: { payment_status: "paid" },
    });
  });
});
