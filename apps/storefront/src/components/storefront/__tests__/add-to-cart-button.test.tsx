import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AddToCartButton } from "../add-to-cart-button";
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

describe("AddToCartButton", () => {
  it("renders ADD TO CART", () => {
    render(<AddToCartButton product={baseProduct} />);
    expect(screen.getByText("ADD TO CART")).toBeDefined();
  });

  it("click adds item to cart", () => {
    render(<AddToCartButton product={baseProduct} />);
    fireEvent.click(screen.getByText("ADD TO CART"));
    const state = useCart.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].product_id).toBe("prod-1");
    expect(state.items[0].name).toBe("Test Product");
    expect(state.items[0].price).toBe(4999);
    expect(state.items[0].image).toBe("/image1.jpg");
  });

  it("shows Added! after click", () => {
    vi.useFakeTimers();
    render(<AddToCartButton product={baseProduct} />);
    fireEvent.click(screen.getByText("ADD TO CART"));
    expect(screen.getByText("Added!")).toBeDefined();
    vi.useRealTimers();
  });
});
