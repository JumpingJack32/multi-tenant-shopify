import { z } from "zod";

// ==========================================
// Shared & Enums
// ==========================================

export const TenantContextSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    tenantId: string;
    userId?: string | undefined;
  },
  {
    tenantId: string;
    userId?: string | undefined;
  }
> = z.object({
  tenantId: z.string(),
  userId: z.string().optional(),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

export const TenantStatusSchema = z.enum(["active", "suspended", "deleted"]);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const ProductStatusSchema = z.enum(["draft", "published", "archived"]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const OrderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const StockStatusSchema = z.enum([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "discontinued",
]);
export type StockStatus = z.infer<typeof StockStatusSchema>;

// ==========================================
// Tenant & Category
// ==========================================

export const TenantInfoSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: TenantStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type TenantInfo = z.infer<typeof TenantInfoSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  sort_order: z.number(),
  is_active: z.boolean(),
  product_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

// ==========================================
// Product
// ==========================================

export const ProductImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt_text: z.string().nullable(),
  sort_order: z.number(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSpecSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const ProductSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  status: ProductStatusSchema,
  weight: z.number().nullable(),
  weight_unit: z.string(),
  is_active: z.boolean(),
  price: z.number().nullable().optional(),
  specs: z.array(ProductSpecSchema).nullable().optional(),
  images: z.array(ProductImageSchema).nullable().optional(),
  category_id: z.string().nullable().optional(),
  collection_ids: z.array(z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductCreateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  status: ProductStatusSchema.optional(),
  weight: z.number().nullable().optional(),
  weight_unit: z.string().optional(),
  is_active: z.boolean().optional(),
  price: z.number().nullable().optional(),
  specs: z.array(ProductSpecSchema).nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
});
export type ProductCreate = z.infer<typeof ProductCreateSchema>;

export const ProductUpdateSchema = ProductCreateSchema.partial();
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;

// ==========================================
// Order
// ==========================================

export const OrderSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  customer_email: z.string(),
  status: OrderStatusSchema,
  total: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderItemSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  product_id: z.string(),
  tenant_id: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

// ==========================================
// Collection
// ==========================================

export const CollectionSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  hero_image_url: z.string().nullable(),
  hero_image_alt: z.string().nullable(),
  sort_order: z.number(),
  is_active: z.boolean(),
  product_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const CollectionCreateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  hero_image_url: z.string().nullable().optional(),
  hero_image_alt: z.string().nullable().optional(),
  sort_order: z.number().optional(),
});
export type CollectionCreate = z.infer<typeof CollectionCreateSchema>;

export const CollectionUpdateSchema = CollectionCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type CollectionUpdate = z.infer<typeof CollectionUpdateSchema>;

// ==========================================
// Customer
// ==========================================

export const CustomerSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  phone: z.string().nullable(),
  is_verified: z.boolean(),
  total_orders: z.number(),
  total_spent: z.number(),
  last_order_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerAddressSchema = z.object({
  id: z.string(),
  address_type: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  province: z.string().nullable(),
  postal_code: z.string(),
  country: z.string(),
  is_default: z.boolean(),
});
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;

export const CustomerOrderSchema = z.object({
  id: z.string(),
  order_number: z.string(),
  total: z.number(),
  status: z.string(),
  created_at: z.string(),
});
export type CustomerOrder = z.infer<typeof CustomerOrderSchema>;

export const CustomerDetailSchema = CustomerSchema.extend({
  average_order_value: z.number(),
  addresses: z.array(CustomerAddressSchema),
  orders: z.array(CustomerOrderSchema),
});
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;

// ==========================================
// Dashboard
// ==========================================

export const DashboardLowStockItemSchema = z.object({
  variant_id: z.string(),
  product_name: z.string(),
  sku: z.string(),
  quantity: z.number(),
  threshold: z.number(),
});
export type DashboardLowStockItem = z.infer<typeof DashboardLowStockItemSchema>;

export const DashboardRecentOrderSchema = z.object({
  id: z.string(),
  order_number: z.string(),
  customer_name: z.string().nullable(),
  total: z.number(),
  status: z.string(),
  created_at: z.string(),
});
export type DashboardRecentOrder = z.infer<typeof DashboardRecentOrderSchema>;

export const DashboardSummarySchema = z.object({
  revenue_mtd: z.number(),
  revenue_total: z.number(),
  revenue_prev_mtd: z.number(),
  orders_mtd: z.number(),
  orders_total: z.number(),
  orders_prev_mtd: z.number(),
  aov: z.number(),
  active_customers: z.number(),
  active_customers_prev: z.number(),
  fulfillment: z.object({
    unfulfilled: z.number(),
    processing: z.number(),
    shipped: z.number(),
    delivered: z.number(),
  }),
  low_stock: z.array(DashboardLowStockItemSchema),
  recent_orders: z.array(DashboardRecentOrderSchema),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

// ==========================================
// Inventory
// ==========================================

export const InventoryVariantSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  name: z.string(),
  sku: z.string(),
  barcode: z.string().nullable(),
  price: z.number(),
  cost: z.number(),
  stock: z.number(),
  reorder_point: z.number(),
  warehouse: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type InventoryVariant = z.infer<typeof InventoryVariantSchema>;

export const InventoryItemSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  image_url: z.string().nullable(),
  status: StockStatusSchema,
  supplier: z.string().nullable(),
  total_stock: z.number(),
  total_value: z.number(),
  variants: z.array(InventoryVariantSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const InventoryStatsSchema = z.object({
  total_skus: z.number(),
  total_value: z.number(),
  low_stock_count: z.number(),
  out_of_stock_count: z.number(),
  total_variants: z.number(),
});
export type InventoryStats = z.infer<typeof InventoryStatsSchema>;

export const InventoryListResponseSchema = z.object({
  data: z.array(InventoryItemSchema),
  pagination: z.object({
    page: z.number(),
    page_size: z.number(),
    total: z.number(),
    total_pages: z.number(),
  }),
});
export type InventoryListResponse = z.infer<typeof InventoryListResponseSchema>;
