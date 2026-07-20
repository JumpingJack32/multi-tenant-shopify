import type {
  AssociatedPO,
  Collection,
  Customer,
  CustomerDetail,
  CustomerListResponse,
  CustomerMetrics,
  DashboardSummary,
  InventoryItem,
  InventoryListResponse,
  InventoryStats,
  Order,
  OrderListResponse,
  Product,
  ProductCreate,
  ProductUpdate,
  PurchaseOrder,
  PurchaseOrderListResponse,
  SavedSegment,
  StockTransfer,
  StockTransferListResponse,
  StoreCreditResponse,
  StoreCreditTransaction,
  Supplier,
  SupplierListResponse,
  TimelineEvent,
} from "@repo/tenant-orm/types";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { getToken } = await import("@clerk/nextjs");
    return getToken() ?? null;
  } catch {
    return null;
  }
}

interface RequestOptions {
  tenantId?: string | null;
  parseAsBlob?: boolean;
  [key: string]: unknown;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit & RequestOptions = {},
): Promise<T> {
  const { tenantId, parseAsBlob, ...rest } = options;
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (rest.headers) {
    Object.assign(headers, rest.headers);
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers["X-Tenant-ID"] = tenantId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => null);
    let message = "Request failed";
    try {
      const error = JSON.parse(body || "{}");
      message = error.detail || error.message || message;
    } catch {
      if (body) message = body;
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return null as T;
  }

  if (parseAsBlob) {
    return response.blob() as T;
  }

  return response.json() as T;
}

function buildQuery(params?: Record<string, string>): string {
  if (!params) return "";
  const q = new URLSearchParams(params).toString();
  return q ? `?${q}` : "";
}

export const api = {
  products: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      const query = new URLSearchParams(params).toString();
      return request<Product[]>(
        `/products${query ? `?${query}` : ""}`,
        options ?? {},
      );
    },

    get(id: string, options?: { tenantId?: string | null }) {
      return request<Product>(`/products/${id}`, options ?? {});
    },

    create(data: ProductCreate, options?: { tenantId?: string | null }) {
      return request<Product>("/products", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },

    update(
      id: string,
      data: ProductUpdate,
      options?: { tenantId?: string | null },
    ) {
      return request<Product>(`/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        ...options,
      });
    },

    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>(`/products/${id}`, { method: "DELETE", ...options });
    },
  },

  customers: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<CustomerListResponse>(
        `/customers${buildQuery(params)}`,
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<CustomerDetail>(`/customers/${id}`, options ?? {});
    },
    create(
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<Customer>(`/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>(`/customers/${id}`, {
        method: "DELETE",
        ...options,
      });
    },
    getMetrics(options?: { tenantId?: string | null }) {
      return request<CustomerMetrics>("/customers/metrics", options ?? {});
    },
    getTimeline(id: string, options?: { tenantId?: string | null }) {
      return request<TimelineEvent[]>(
        `/customers/${id}/timeline`,
        options ?? {},
      );
    },
    addTimelineEvent(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<TimelineEvent>(`/customers/${id}/timeline`, {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    getCredit(id: string, options?: { tenantId?: string | null }) {
      return request<StoreCreditResponse>(
        `/customers/${id}/credit`,
        options ?? {},
      );
    },
    addCredit(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<StoreCreditTransaction>(`/customers/${id}/credit`, {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    exportCsv(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<Blob>(`/customers/export${buildQuery(params)}`, {
        ...options,
        parseAsBlob: true,
      });
    },
    importCsv(file: File, options?: { tenantId?: string | null }) {
      const formData = new FormData();
      formData.append("file", file);
      const tid = options?.tenantId;
      return request<{
        total: number;
        imported: number;
        errors: Array<Record<string, unknown>>;
      }>("/customers/import", {
        method: "POST",
        body: formData,
        ...(tid ? { tenantId: tid } : {}),
      });
    },
    resolveCsvErrors(
      corrections: Array<Record<string, unknown>>,
      options?: { tenantId?: string | null },
    ) {
      const tid = options?.tenantId;
      return request<{ fixed: number; errors: number }>(
        "/customers/import/resolve",
        {
          method: "POST",
          body: JSON.stringify({ corrections }),
          ...(tid ? { tenantId: tid } : {}),
        },
      );
    },
  },

  collections: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<Collection[]>(
        `/collections${buildQuery(params)}`,
        options ?? {},
      );
    },
    create(data: unknown, options?: { tenantId?: string | null }) {
      return request<unknown>("/collections/", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(id: string, data: unknown, options?: { tenantId?: string | null }) {
      return request<unknown>(`/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<{ status: string }>(`/collections/${id}`, {
        method: "DELETE",
        ...options,
      });
    },
    products(id: string, options?: { tenantId?: string | null }) {
      return request<unknown[]>(`/collections/${id}/products`, options ?? {});
    },
    addProducts(
      id: string,
      productIds: string[],
      options?: { tenantId?: string | null },
    ) {
      return request<unknown>(`/collections/${id}/products`, {
        method: "POST",
        body: JSON.stringify({ product_ids: productIds }),
        ...options,
      });
    },
    removeProduct(
      collectionId: string,
      productId: string,
      options?: { tenantId?: string | null },
    ) {
      return request<unknown>(
        `/collections/${collectionId}/products/${productId}`,
        { method: "DELETE", ...options },
      );
    },
  },

  dashboard: {
    summary(options?: { tenantId?: string | null; period?: string }) {
      const { period, ...rest } = options ?? {};
      const query = period ? `?period=${period}` : "";
      return request<DashboardSummary>(
        `/admin/dashboard/summary${query}`,
        rest,
      );
    },
  },

  marketing: {
    templates: {
      list(options?: { tenantId?: string | null }) {
        return request<Array<Record<string, unknown>>>(
          "/marketing/templates",
          options ?? {},
        );
      },
      get(id: string, options?: { tenantId?: string | null }) {
        return request<Record<string, unknown>>(
          `/marketing/templates/${id}`,
          options ?? {},
        );
      },
      create(
        data: Record<string, unknown>,
        options?: { tenantId?: string | null },
      ) {
        return request<Record<string, unknown>>("/marketing/templates", {
          method: "POST",
          body: JSON.stringify(data),
          ...options,
        });
      },
      update(
        id: string,
        data: Record<string, unknown>,
        options?: { tenantId?: string | null },
      ) {
        return request<Record<string, unknown>>(`/marketing/templates/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
          ...options,
        });
      },
      delete(id: string, options?: { tenantId?: string | null }) {
        return request<void>(`/marketing/templates/${id}`, {
          method: "DELETE",
          ...options,
        });
      },
    },
  },

  suppliers: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<SupplierListResponse>(
        "/suppliers" + buildQuery(params),
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<Supplier>("/suppliers/" + id, options ?? {});
    },
    create(
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<Supplier>("/suppliers", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<Supplier>("/suppliers/" + id, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>("/suppliers/" + id, {
        method: "DELETE",
        ...options,
      });
    },
  },

  segments: {
    list(options?: { tenantId?: string | null }) {
      return request<SavedSegment[]>("/segments", options ?? {});
    },
    create(
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<SavedSegment>("/segments", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<SavedSegment>("/segments/" + id, {
        method: "PUT",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>("/segments/" + id, { method: "DELETE", ...options });
    },
  },

  purchaseOrders: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<PurchaseOrderListResponse>(
        "/purchase-orders" + buildQuery(params),
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id, options ?? {});
    },
    approve(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/approve", {
        method: "POST",
        ...options,
      });
    },
    cancel(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/cancel", {
        method: "POST",
        ...options,
      });
    },
    updateTracking(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<PurchaseOrder>("/purchase-orders/" + id, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...options,
      });
    },
    markConfirmed(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/confirm", {
        method: "POST",
        ...options,
      });
    },
    markInTransit(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/in-transit", {
        method: "POST",
        ...options,
      });
    },
    markClosed(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/close", {
        method: "POST",
        ...options,
      });
    },
    batchApprove(ids: string[], options?: { tenantId?: string | null }) {
      return request<{ approved: number }>("/purchase-orders/batch/approve", {
        method: "POST",
        body: JSON.stringify({ ids }),
        ...options,
      });
    },
  },

  orders: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<OrderListResponse>(
        "/orders" + buildQuery(params),
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<Order>("/orders/" + id, options ?? {});
    },
    updateStatus(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<Order>("/orders/" + id, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...options,
      });
    },
    getLinkedPOs(id: string, options?: { tenantId?: string | null }) {
      return request<AssociatedPO[]>(
        "/orders/" + id + "/purchase-orders",
        options ?? {},
      );
    },
  },

  inventory: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<InventoryListResponse>(
        `/inventory${buildQuery(params)}`,
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<InventoryItem>(`/inventory/${id}`, options ?? {});
    },
    stats(options?: { tenantId?: string | null }) {
      return request<InventoryStats>("/inventory/stats", options ?? {});
    },
    create(
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<InventoryItem>("/inventory", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<InventoryItem>(`/inventory/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>(`/inventory/${id}`, {
        method: "DELETE",
        ...options,
      });
    },
  },

  stockTransfers: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<StockTransferListResponse>(
        `/stock-transfers${buildQuery(params)}`,
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<StockTransfer>(`/stock-transfers/${id}`, options ?? {});
    },
    create(
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<StockTransfer>("/stock-transfers", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<StockTransfer>(`/stock-transfers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>(`/stock-transfers/${id}`, {
        method: "DELETE",
        ...options,
      });
    },
  },
};
