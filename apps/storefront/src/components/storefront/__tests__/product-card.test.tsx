import type { Product } from "@repo/tenant-orm/types";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";

import { ProductCard } from "../product-card";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "test-tenant" }),
  useRouter: () => ({ push: mockPush }),
}));

afterEach(() => {
  cleanup();
  mockPush.mockClear();
});

const baseProduct: Product = {
  id: "1",
  tenant_id: "tenant-1",
  name: "Test Product",
  slug: "test-product",
  description: "A great product",
  sku: null,
  status: "published",
  weight: null,
  weight_unit: "g",
  is_active: true,
  price: 29.99,
  specs: null,
  images: null,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

describe("ProductCard", () => {
  it("renders product name and price", () => {
    render(<ProductCard product={baseProduct} categorySlug="cats" />);
    expect(screen.getByText("£29.99")).toBeDefined();
    expect(screen.getAllByText("Test Product").length).toBe(2);
  });

  it("renders placeholder text when no images", () => {
    render(<ProductCard product={baseProduct} categorySlug="cats" />);
    const nameElements = screen.getAllByText("Test Product");
    expect(nameElements.length).toBe(2);
  });

  it("navigates on click", async () => {
    render(<ProductCard product={baseProduct} categorySlug="cats" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("link"));

    expect(mockPush).toHaveBeenCalledWith(
      "/test-tenant/shop/cats/test-product",
    );
  });
});
