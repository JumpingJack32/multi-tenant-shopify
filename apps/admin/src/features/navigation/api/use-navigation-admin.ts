import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export function useNavigationMenus(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["navigation", "menus", tid],
    queryFn: () => api.navigation.listMenus({ tenantId: tid }),
    enabled: !!tid,
  });
}

export function useNavigationTree(
  menuId: string | null,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["navigation", "tree", menuId, tid],
    queryFn: () => api.navigation.getTree(menuId!, { tenantId: tid }),
    enabled: !!tid && !!menuId,
  });
}

export function useReconcileNavigationTree(
  menuId: string,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: unknown[] }) =>
      api.navigation.reconcileTree(menuId, data, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["navigation", "tree", menuId, tid],
      });
    },
  });
}

export function useCreateMenu(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { slug: string; title: string }) =>
      api.navigation.createMenu(data, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navigation", "menus", tid] });
    },
  });
}

export function useUpdateMenu(menuId: string, tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string }) =>
      api.navigation.updateMenu(menuId, data, { tenantId: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navigation", "menus", tid] });
    },
  });
}

export function useSearchCategories(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useMutation({
    mutationFn: (query: string) =>
      api.navigation.searchCategories(query, { tenantId: tid }),
  });
}

export function useSearchCollections(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useMutation({
    mutationFn: (query: string) =>
      api.navigation.searchCollections(query, { tenantId: tid }),
  });
}

export function useSearchProducts(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useMutation({
    mutationFn: (query: string) =>
      api.navigation.searchProducts(query, { tenantId: tid }),
  });
}
