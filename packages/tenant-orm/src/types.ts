import { v4 as uuidv4 } from "uuid";

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

export interface TenantInfo {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deleted";
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  status: "draft" | "published" | "archived";
  weight: number | null;
  weight_unit: string;
  is_active: boolean;
  price?: number | null;
  specs?: { label: string; value: string }[] | null;
  images?: ProductImage[] | null;
  category_id?: string | null;
  collection_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  slug: string;
  description?: string | null;
  sku?: string | null;
  status?: "draft" | "published" | "archived";
  weight?: number | null;
  weight_unit?: string;
  is_active?: boolean;
  price?: number | null;
  specs?: { label: string; value: string }[] | null;
  images?: string[] | null;
}

export interface ProductUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  sku?: string | null;
  status?: "draft" | "published" | "archived";
  weight?: number | null;
  weight_unit?: string;
  is_active?: boolean;
  price?: number | null;
  specs?: { label: string; value: string }[] | null;
  images?: string[] | null;
}

export interface Order {
  id: string;
  tenant_id: string;
  customer_email: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  tenant_id: string;
  quantity: number;
  unit_price: number;
}

export interface Collection {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionCreate {
  name: string;
  slug: string;
  description?: string | null;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
  sort_order?: number;
}

export interface CollectionUpdate extends Partial<CollectionCreate> {
  is_active?: boolean;
}

export interface Customer {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_verified: boolean;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  address_type: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  average_order_value: number;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
}

export interface DashboardSummary {
  revenue_mtd: number;
  revenue_total: number;
  revenue_prev_mtd: number;
  orders_mtd: number;
  orders_total: number;
  orders_prev_mtd: number;
  aov: number;
  active_customers: number;
  active_customers_prev: number;
  fulfillment: {
    unfulfilled: number;
    processing: number;
    shipped: number;
    delivered: number;
  };
  low_stock: Array<{ id: string; name: string; stock: number }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
  }>;
}

export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "discontinued";

export interface InventoryVariant {
  id: string;
  item_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  cost: number;
  stock: number;
  reorder_point: number;
  warehouse: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  status: StockStatus;
  supplier: string | null;
  total_stock: number;
  total_value: number;
  variants: InventoryVariant[];
  created_at: string;
  updated_at: string;
}

export interface InventoryStats {
  total_skus: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_variants: number;
}

export interface InventoryListResponse {
  data: InventoryItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}
