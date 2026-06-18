import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  price: z.number().int().positive(),
  sku: z.string().nullable(),
  status: z.enum(["draft", "active", "archived"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProductCreateSchema = ProductSchema.omit({ id: true, created_at: true, updated_at: true });

export const OrderSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  customer_email: z.string().email(),
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
  total: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const OrderCreateSchema = OrderSchema.omit({ id: true, created_at: true, updated_at: true });

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().int().nonnegative(),
});

export const OrderItemCreateSchema = OrderItemSchema.omit({ id: true });
