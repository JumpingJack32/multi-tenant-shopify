import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]),
  weight: z.number().nullable().optional(),
  weight_unit: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  weight: z.number().nullable().optional(),
  weight_unit: z.string().default("kg"),
  is_active: z.boolean().default(true),
});

export const ProductUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  weight: z.number().nullable().optional(),
  weight_unit: z.string().optional(),
  is_active: z.boolean().optional(),
});

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
