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
      })
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
      })
    ).toThrow();
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
