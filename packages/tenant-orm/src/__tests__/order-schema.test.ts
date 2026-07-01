import { describe, it, expect } from "vitest";
import { OrderSchema, OrderItemSchema } from "../schemas/tenant";

describe("OrderSchema", () => {
  it("parses a valid order", () => {
    const result = OrderSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenant_id: "550e8400-e29b-41d4-a716-446655440001",
      customer_email: "test@example.com",
      status: "confirmed",
      total: 2999,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result.total).toBe(2999);
  });

  it("rejects invalid email", () => {
    expect(() =>
      OrderSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        customer_email: "not-an-email",
        status: "pending",
        total: 1000,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
    ).toThrow();
  });

  it("rejects negative total", () => {
    expect(() =>
      OrderSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        customer_email: "test@example.com",
        status: "pending",
        total: -100,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
    ).toThrow();
  });
});

describe("OrderItemSchema", () => {
  it("parses a valid order item", () => {
    const result = OrderItemSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      order_id: "550e8400-e29b-41d4-a716-446655440001",
      product_id: "550e8400-e29b-41d4-a716-446655440002",
      tenant_id: "550e8400-e29b-41d4-a716-446655440003",
      quantity: 2,
      unit_price: 1500,
    });
    expect(result.quantity).toBe(2);
  });

  it("rejects zero quantity", () => {
    expect(() =>
      OrderItemSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        order_id: "550e8400-e29b-41d4-a716-446655440001",
        product_id: "550e8400-e29b-41d4-a716-446655440002",
        tenant_id: "550e8400-e29b-41d4-a716-446655440003",
        quantity: 0,
        unit_price: 1500,
      })
    ).toThrow();
  });
});
