import type { Product } from "@repo/tenant-orm/types";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { ProductTable } from "../product-table";

const mockProducts: Product[] = [
  {
    id: "1",
    tenant_id: "t1",
    name: "Test Product",
    slug: "test-product",
    description: "A test",
    sku: "SKU-1",
    status: "published",
    weight: 1.0,
    weight_unit: "kg",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

function renderTable(overrides = {}) {
  const props = {
    products: [],
    loading: false,
    total: 0,
    page: 1,
    pageSize: 20,
    search: "",
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onSearchChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return render(<ProductTable {...props} />);
}

afterEach(() => {
  cleanup();
});

describe("ProductTable", () => {
  it("renders product rows", () => {
    renderTable({ products: mockProducts, total: 1 });
    expect(screen.getByText("Test Product")).toBeDefined();
    expect(screen.getByText("published")).toBeDefined();
  });

  it("shows loading spinner", () => {
    renderTable({ loading: true });
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("shows empty state", () => {
    renderTable();
    expect(screen.getByText("No products found.")).toBeDefined();
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn();
    renderTable({ products: mockProducts, total: 1, onEdit });
    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith(mockProducts[0]);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    renderTable({ products: mockProducts, total: 1, onDelete });
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(mockProducts[0]);
  });
});
