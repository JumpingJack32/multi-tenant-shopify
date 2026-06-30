import { api } from "@/lib/api/client";
import type { Product, ProductCreate, ProductUpdate } from "@repo/tenant-orm/types";

export interface ProductsResponse {
  data: Product[];
  total: number;
}

function getTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export async function fetchProducts(params?: {
  search?: string;
  page?: string;
  limit?: string;
}): Promise<ProductsResponse> {
  const tenantId = getTenantId();

  if (!tenantId) {
    return { data: [], total: 0 };
  }

  const result = await api.products.list({
    ...(params?.search && { search: params.search }),
    ...(params?.page && { page: params.page }),
    ...(params?.limit && { limit: params.limit }),
  }, { tenantId });

  return {
    data: result as Product[],
    total: result.length,
  };
}

export async function createProduct(data: ProductCreate): Promise<Product> {
  const tenantId = getTenantId();

  if (!tenantId) {
    throw new Error("No tenant selected");
  }

  return api.products.create(data);
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product> {
  const tenantId = getTenantId();

  if (!tenantId) {
    throw new Error("No tenant selected");
  }

  return api.products.update(id, data);
}

export async function deleteProduct(id: string): Promise<void> {
  const tenantId = getTenantId();

  if (!tenantId) {
    throw new Error("No tenant selected");
  }

  return api.products.delete(id);
}
