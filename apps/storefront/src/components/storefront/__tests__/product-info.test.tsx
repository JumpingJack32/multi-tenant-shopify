import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductInfo } from "../product-info";
import { useCart } from "@/hooks/use-cart";
import type { Product } from "@repo/tenant-orm/types";

afterEach(() => {
  cleanup();
  useCart.getState().clear();
});

const baseProduct: Product = {
  id: "prod-1",
  tenant_id: "tenant-1",
  name: "Test Product",
  slug: "test-product",
  description: "A great product",
  sku: null,
  status: "published",
  weight: null,
  weight_unit: "g",
  is_active: true,
  price: 4999,
  specs: null,
  images: ["/image1.jpg"],
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

const productWithSpecs: Product = {
  ...baseProduct,
  specs: [
    { label: "MATERIAL", value: "Cordura® Ballistic Nylon" },
    { label: "CLOSURE", value: "Magnetic Fidlock® Buckles" },
  ],
};

describe("ProductInfo", () => {
  it("renders product name and price", () => {
    render(<ProductInfo product={baseProduct} />);
    expect(screen.getByText("Test Product")).toBeDefined();
    expect(screen.getByText("£49.99")).toBeDefined();
  });

  it("renders specs when provided", () => {
    render(<ProductInfo product={productWithSpecs} />);
    expect(screen.getByText("MATERIAL")).toBeDefined();
    expect(screen.getByText("Cordura® Ballistic Nylon")).toBeDefined();
    expect(screen.getByText("CLOSURE")).toBeDefined();
    expect(screen.getByText("Magnetic Fidlock® Buckles")).toBeDefined();
  });

  it("hides specs section when null", () => {
    render(<ProductInfo product={baseProduct} />);
    expect(screen.queryByText("MATERIAL")).toBeNull();
  });
});
