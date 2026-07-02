import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProductForm } from "../product-form";
import type { Product } from "@repo/tenant-orm/types";

const mockProduct: Product = {
  id: "1",
  tenant_id: "t1",
  name: "Test Product",
  slug: "test-product",
  description: "A test",
  sku: "SKU-1",
  status: "published",
  weight: 1.5,
  weight_unit: "kg",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
});

describe("ProductForm", () => {
  it("renders create form with correct button text", () => {
    render(<ProductForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Create Product")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("renders update form with correct button text", () => {
    render(
      <ProductForm
        initialData={mockProduct}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Update Product")).toBeDefined();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(<ProductForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onSubmit with form data", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Enter product name"), {
      target: { value: "New Product" },
    });
    fireEvent.change(screen.getByPlaceholderText("product-slug"), {
      target: { value: "new-product" },
    });

    fireEvent.click(screen.getByText("Create Product"));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it("renders all form fields", () => {
    render(<ProductForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Product Name")).toBeDefined();
    expect(screen.getByLabelText("Slug")).toBeDefined();
    expect(screen.getByLabelText("Status")).toBeDefined();
    expect(screen.getByLabelText("Active")).toBeDefined();
    expect(screen.getByLabelText("Weight")).toBeDefined();
    expect(screen.getByLabelText("Unit")).toBeDefined();
  });

  it("shows saving state when submitting", async () => {
    const onSubmit = vi.fn(() => new Promise<void>((r) => setTimeout(r, 1000)));
    render(<ProductForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Enter product name"), {
      target: { value: "New Product" },
    });
    fireEvent.change(screen.getByPlaceholderText("product-slug"), {
      target: { value: "new-product" },
    });

    fireEvent.click(screen.getByText("Create Product"));

    expect(await screen.findByText("Saving...")).toBeDefined();
  });
});
