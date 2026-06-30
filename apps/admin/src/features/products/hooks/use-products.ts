import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../api/products-service";
import type { Product, ProductCreate, ProductUpdate } from "@repo/tenant-orm/types";
// import { useTenant } from "@/hooks/use-tenant"; // Adjust based on your actual use-tenant hook
// import { useRbac } from "@/context/rbac-context"; // Adjust based on your rbac-context path

export function useProducts(params?: {
  search?: string;
  page?: string;
  limit?: string;
}) {

  return useQuery({
    queryKey: ["products", params],
    queryFn: () => fetchProducts(params),

  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductCreate) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) =>
      updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
