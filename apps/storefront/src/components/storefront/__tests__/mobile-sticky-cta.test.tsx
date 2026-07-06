import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MobileStickyCta } from "../mobile-sticky-cta";
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

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    })),
  );
});

describe("MobileStickyCta", () => {
  it("renders formatted price", () => {
    render(<MobileStickyCta product={baseProduct} />);
    expect(screen.getByText("£49.99")).toBeDefined();
  });

  it("renders AddToCartButton", () => {
    render(<MobileStickyCta product={baseProduct} />);
    expect(screen.getByText("ADD TO CART")).toBeDefined();
  });

  it("renders nothing when product is missing price", () => {
    const noPrice = { ...baseProduct, price: null };
    const { container } = render(<MobileStickyCta product={noPrice} />);
    expect(screen.getByText("ADD TO CART")).toBeDefined();
    expect(container.querySelector("span")).toBeNull();
  });
});
