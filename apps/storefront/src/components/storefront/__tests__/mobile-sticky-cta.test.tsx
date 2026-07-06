import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { act } from "react";
import { MobileStickyCta } from "../mobile-sticky-cta";
import { useCart } from "@/hooks/use-cart";
import type { Product } from "@repo/tenant-orm/types";

afterEach(() => {
  cleanup();
  useCart.getState().clear();
  vi.unstubAllGlobals();
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
  price: 49.99,
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
    expect(screen.getByText("£49.99")).toBeInTheDocument();
  });

  it("renders AddToCartButton", () => {
    render(<MobileStickyCta product={baseProduct} />);
    expect(screen.getByText("ADD TO CART")).toBeInTheDocument();
  });

  it("renders nothing when product is missing price", () => {
    const noPrice = { ...baseProduct, price: null };
    const { container } = render(<MobileStickyCta product={noPrice} />);
    expect(screen.getByText("ADD TO CART")).toBeInTheDocument();
    expect(container.querySelector("span")).toBeNull();
  });

  it("shows bar when inline CTA scrolls out of view", () => {
    document.body.innerHTML = '<div id="pdp-inline-cta"></div>';
    let observerCallback: (entries: IntersectionObserverEntry[]) => void;

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((cb) => {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
      }),
    );

    render(<MobileStickyCta product={baseProduct} />);

    const container = screen.getByTestId("sticky-cta-wrapper");
    expect(container).toHaveAttribute("data-visible", "false");

    act(() => {
      observerCallback!([
        { isIntersecting: false } as IntersectionObserverEntry,
      ]);
    });
    expect(container).toHaveAttribute("data-visible", "true");

    act(() => {
      observerCallback!([
        { isIntersecting: true } as IntersectionObserverEntry,
      ]);
    });
    expect(container).toHaveAttribute("data-visible", "false");
  });
});
