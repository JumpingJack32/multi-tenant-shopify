import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import type { Product } from "@repo/tenant-orm/types";

import { ProductGrid } from "../product-grid";

const mockPush = vi.fn();

vi.mock("next-cloudinary", () => ({
  CldImage: ({ width: _w, height: _h, ...rest }: Record<string, unknown>) => (
    <img {...rest} />
  ),
}));

vi.mock("next/image", () => ({
  default: ({ width: _w, height: _h, ...rest }: Record<string, unknown>) => (
    <img {...rest} />
  ),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "test-tenant" }),
  useRouter: () => ({ push: mockPush }),
}));

afterEach(() => {
  cleanup();
});

const mockProducts: Product[] = [
  {
    id: "1",
    tenant_id: "tenant-1",
    name: "Test Product 1",
    slug: "test-product-1",
    description: "A test product",
    sku: null,
    status: "published",
    weight: null,
    weight_unit: "g",
    is_active: true,
    price: 19.99,
    specs: null,
    images: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "2",
    tenant_id: "tenant-1",
    name: "Test Product 2",
    slug: "test-product-2",
    description: "Another test product",
    sku: null,
    status: "published",
    weight: null,
    weight_unit: "g",
    is_active: true,
    price: 29.99,
    specs: null,
    images: [{ id: "img-1", url: "/img1.jpg", alt_text: null, sort_order: 0 }],
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders products from mocked fetch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProducts),
    });

    render(await ProductGrid({ tenantSlug: "test-tenant" }));
    expect(screen.getAllByText("Test Product 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test Product 2").length).toBeGreaterThan(0);
  });

  it("shows empty state when fetch returns empty array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(await ProductGrid({ tenantSlug: "test-tenant" }));
    expect(screen.getByText("No products available yet.")).toBeDefined();
  });

  it("handles fetch error gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(await ProductGrid({ tenantSlug: "test-tenant" }));
    expect(screen.getByText("No products available yet.")).toBeDefined();
  });
});
