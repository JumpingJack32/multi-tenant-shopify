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
