import type {
  Product,
  ProductCreate,
  ProductUpdate,
} from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

export interface ProductsResponse {
  data: Product[];
  total: number;
}

export async function fetchProduct(
  id: string,
  tenantId?: string | null,
): Promise<Product> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.products.get(id, { tenantId: tid });
}

export async function fetchProducts(
  params?: {
    search?: string;
    page?: string;
    limit?: string;
  },
  tenantId?: string | null,
): Promise<ProductsResponse> {
  const tid = tenantId ?? getStorageTenantId();

  if (!tid) {
    return { data: [], total: 0 };
  }

  const result = await api.products.list(
    {
      ...(params?.search && { search: params.search }),
      ...(params?.page && { page: params.page }),
      ...(params?.limit && { limit: params.limit }),
    },
    { tenantId: tid },
  );

  return {
    data: result as Product[],
    total: result.length,
  };
}

export async function createProduct(
  data: ProductCreate,
  tenantId?: string | null,
): Promise<Product> {
  const tid = tenantId ?? getStorageTenantId();

  if (!tid) {
    throw new Error("No tenant selected");
  }

  return api.products.create(data, { tenantId: tid });
}

export async function updateProduct(
  id: string,
  data: ProductUpdate,
  tenantId?: string | null,
): Promise<Product> {
  const tid = tenantId ?? getStorageTenantId();

  if (!tid) {
    throw new Error("No tenant selected");
  }

  return api.products.update(id, data, { tenantId: tid });
}

export async function deleteProduct(
  id: string,
  tenantId?: string | null,
): Promise<void> {
  const tid = tenantId ?? getStorageTenantId();

  if (!tid) {
    throw new Error("No tenant selected");
  }

  return api.products.delete(id, { tenantId: tid });
}

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}
