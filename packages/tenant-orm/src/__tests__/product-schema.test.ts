import { describe, it, expect } from "vitest";
import { ProductSchema, ProductCreateSchema } from "../schemas/tenant";

describe("ProductSchema", () => {
  it("parses a valid product", () => {
    const result = ProductSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenant_id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Test Product",
      slug: "test-product",
      status: "published",
      weight_unit: "kg",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result.name).toBe("Test Product");
  });

  it("rejects missing name", () => {
    expect(() =>
      ProductSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        slug: "test-product",
        status: "published",
        weight_unit: "kg",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toThrow();
  });

  it("rejects invalid status", () => {
    expect(() =>
      ProductSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Test",
        slug: "test",
        status: "nonexistent",
        weight_unit: "kg",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toThrow();
  });

  it("accepts price, specs and images", () => {
    const result = ProductSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      tenant_id: "00000000-0000-0000-0000-000000000002",
      name: "Test",
      slug: "test",
      status: "published",
      weight_unit: "kg",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      price: 3499,
      specs: [{ label: "MATERIAL", value: "Nylon" }],
      images: [
        {
          id: "00000000-0000-0000-0000-000000000003",
          url: "demo/products/test-hero",
          alt_text: "Test image",
          sort_order: 0,
        },
      ],
    });
    expect(result.price).toBe(3499);
    expect(result.specs).toEqual([{ label: "MATERIAL", value: "Nylon" }]);
    expect(result.images![0].url).toBe("demo/products/test-hero");
  });

  it("accepts null optional fields", () => {
    const result = ProductSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      tenant_id: "00000000-0000-0000-0000-000000000002",
      name: "Test",
      slug: "test",
      status: "published",
      weight_unit: "kg",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
    expect(result.price).toBeUndefined();
    expect(result.specs).toBeUndefined();
    expect(result.images).toBeUndefined();
  });
});

describe("ProductCreateSchema", () => {
  it("applies default values for optional fields", () => {
    const result = ProductCreateSchema.parse({
      name: "Test",
      slug: "test",
    });
    expect(result.status).toBe("draft");
    expect(result.is_active).toBe(true);
    expect(result.weight_unit).toBe("kg");
  });
});
