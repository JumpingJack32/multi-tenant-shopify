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
  customer_id: string | null;
  customer_email: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_intent_id: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  shipping_address: Record<string, unknown>;
  billing_address: Record<string, unknown>;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string | null;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  created_at: string;
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
  email_subscription_status: string;
  email_subscription_type: string | null;
  tags: Record<string, boolean>;
  notes: string | null;
  store_credit: number;
  last_synced_at: string | null;
  language: string;
  email_marketing_consent: boolean;
  sms_marketing_consent: boolean;
  tax_exempt: boolean;
  tax_exempt_reason: string | null;
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
  company: string | null;
  phone: string | null;
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

export interface StoreCreditTransaction {
  id: string;
  customer_id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  customer_id: string;
  event_type: string;
  description: string;
  extra_data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CustomerMetrics {
  total_customers: number;
  total_base: number;
  percentage: number;
  subscribed: number;
  unsubscribed: number;
  bounced: number;
  with_store_credit: number;
  total_store_credit: number;
  avg_spent: number;
}

export interface CustomerListResponse {
  data: Customer[];
  total: number;
  page: number;
  per_page: number;
}

export interface StoreCreditResponse {
  balance: number;
  transactions: StoreCreditTransaction[];
}

export interface SavedSegment {
  id: string;
  tenant_id: string;
  name: string;
  filters: Record<string, string>;
  customer_count: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardLowStockItem {
  variant_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  threshold: number;
}

export interface DashboardRecentOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

export interface PendingPOStats {
  count: number;
  total: number;
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
  low_stock: DashboardLowStockItem[];
  recent_orders: DashboardRecentOrder[];
  pending_pos: PendingPOStats;
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

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  delivery_method: string;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierListResponse {
  data: Supplier[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  variant_id: string;
  supplier_sku: string | null;
  product_name: string;
  variant_label: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  received_quantity: number | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  source_order_number: string | null;
  supplier_id: string;
  status: string;
  fulfillment_strategy: string;
  ship_to_address_snapshot: Record<string, unknown> | null;
  tracking_number: string | null;
  carrier: string | null;
  subtotal: number;
  tax: number;
  shipping_cost: number;
  total: number;
  notes: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  items: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface OrderListResponse {
  data: Order[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface AssociatedPO {
  id: string;
  po_number: string;
  status: string;
  supplier_name: string;
  total: number;
  fulfillment_strategy: string;
  created_at: string;
}

export interface StockTransferItem {
  id: string;
  variant_id: string;
  quantity: number;
  received_quantity: number | null;
  sku: string;
  product_name: string;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  origin_location_id: string;
  destination_location_id: string;
  origin_location_name: string;
  destination_location_name: string;
  status: string;
  estimated_arrival: string | null;
  carrier: string | null;
  tracking_number: string | null;
  reference_number: string | null;
  notes: string | null;
  sent_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  items: StockTransferItem[];
  created_at: string;
  updated_at: string;
}

export interface StockTransferListResponse {
  data: StockTransfer[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
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
