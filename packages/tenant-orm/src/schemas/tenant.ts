import { z } from "zod";

const ProductImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  alt_text: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
});

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
  price: z.number().nonnegative().nullable().optional(),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .nullable()
    .optional(),
  images: z.array(ProductImageSchema).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  product_count: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CategoryCreateSchema = CategorySchema.omit({
  id: true,
  tenant_id: true,
  is_active: true,
  product_count: true,
  created_at: true,
  updated_at: true,
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial();

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  weight: z.number().nullable().optional(),
  weight_unit: z.string().default("kg"),
  is_active: z.boolean().default(true),
  price: z.number().nonnegative().nullable().optional(),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .nullable()
    .optional(),
  images: z.array(z.string()).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
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
  price: z.number().nonnegative().nullable().optional(),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .nullable()
    .optional(),
  images: z.array(z.string()).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
});

export const CollectionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  hero_image_url: z.string().nullable().optional(),
  hero_image_alt: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  product_count: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CollectionCreateSchema = CollectionSchema.omit({
  id: true,
  tenant_id: true,
  is_active: true,
  product_count: true,
  created_at: true,
  updated_at: true,
});

export const CollectionUpdateSchema = CollectionCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  is_verified: z.boolean(),
  total_orders: z.number().int(),
  total_spent: z.number().int(),
  last_order_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const DashboardSummarySchema = z.object({
  revenue_mtd: z.number().int(),
  revenue_total: z.number().int(),
  revenue_prev_mtd: z.number().int(),
  orders_mtd: z.number().int(),
  orders_total: z.number().int(),
  orders_prev_mtd: z.number().int(),
  aov: z.number().int(),
  active_customers: z.number().int(),
  active_customers_prev: z.number().int(),
  fulfillment: z.object({
    unfulfilled: z.number().int(),
    processing: z.number().int(),
    shipped: z.number().int(),
    delivered: z.number().int(),
  }),
  low_stock: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      stock: z.number().int(),
    }),
  ),
  recent_orders: z.array(
    z.object({
      id: z.string(),
      order_number: z.string(),
      total: z.number().int(),
      status: z.string(),
      created_at: z.string(),
    }),
  ),
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

export const OrderCreateSchema = OrderSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().int().nonnegative(),
});

export const OrderItemCreateSchema = OrderItemSchema.omit({ id: true });
