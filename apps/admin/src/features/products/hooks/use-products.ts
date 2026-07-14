import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Product,
  ProductCreate,
  ProductUpdate,
} from "@repo/tenant-orm/types";

import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../api/products-service";
// import { useTenant } from "@/hooks/use-tenant"; // Adjust based on your actual use-tenant hook
// import { useRbac } from "@/context/rbac-context"; // Adjust based on your rbac-context path

export function useProducts(
  params?: {
    search?: string;
    page?: string;
    limit?: string;
  },
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery({
    queryKey: ["products", params, tid],
    queryFn: () => fetchProducts(params, tid),
    enabled: !!tid,
  });
}

export function useCreateProduct(tenantId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductCreate) => createProduct(data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct(tenantId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) =>
      updateProduct(id, data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct(tenantId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
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
