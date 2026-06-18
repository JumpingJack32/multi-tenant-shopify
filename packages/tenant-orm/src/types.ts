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

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
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
