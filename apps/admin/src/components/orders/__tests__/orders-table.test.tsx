import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { Order } from "@repo/tenant-orm/types";

vi.mock("@repo/tenant-orm/utils", () => ({
  formatCurrency: (n: number) => `£ ${(n / 100).toFixed(2)}`,
}));

import { OrdersTable } from "../orders-table";

afterEach(cleanup);

const MOCK_ORDERS: Order[] = [
  {
    id: "1",
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
  },
  {
    id: "2",
    tenant_id: "tenant-1",
    customer_id: null,
    customer_email: null,
    order_number: "SO-002",
    status: "paid",
    payment_status: "paid",
    payment_method: null,
    payment_intent_id: null,
    subtotal: 2000,
    total: 2000,
    currency: "USD",
    shipping_address: {},
    billing_address: {},
    notes: null,
    items: [],
    created_at: "2025-01-02T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
    tax: 0,
    shipping: 0,
    discount: 0,
  },
];

describe("OrdersTable", () => {
  it("renders order rows", () => {
    const { container } = render(
      <OrdersTable orders={MOCK_ORDERS} onRowClick={() => {}} />,
    );

    expect(container.textContent).toContain("SO-001");
    expect(container.textContent).toContain("SO-002");
    expect(container.textContent).toContain("pending");
  });

  it("shows empty state", () => {
    render(<OrdersTable orders={[]} onRowClick={() => {}} />);

    expect(screen.getByText("No orders found")).toBeDefined();
  });

  it("calls onRowClick when clicked", () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <OrdersTable orders={MOCK_ORDERS} onRowClick={onRowClick} />,
    );

    const rows = container.querySelectorAll("tr");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(rows[1]!);
    expect(onRowClick).toHaveBeenCalledWith("1");
  });

  it("renders customer email or dash", () => {
    const orders = [
      { ...MOCK_ORDERS[0], customer_email: "alice@test.com" } as Order,
      { ...MOCK_ORDERS[1] } as Order,
    ];
    render(<OrdersTable orders={orders} onRowClick={() => {}} />);

    expect(screen.getByText("alice@test.com")).toBeDefined();
  });

  it("renders formatted currency and date", () => {
    const { container } = render(
      <OrdersTable orders={[MOCK_ORDERS[0]!]} onRowClick={() => {}} />,
    );

    expect(container.textContent).toContain("£ 10.00");
    expect(container.textContent).toContain("1/1/2025");
  });
});
