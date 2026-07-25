import { useMutation, useQuery } from "@tanstack/react-query";

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

export function useTopProducts(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "top-products", params, tid],
    queryFn: () => api.analytics.topProducts(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCategoryBreakdown(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "category-breakdown", params, tid],
    queryFn: () => api.analytics.categoryBreakdown(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCustomerRetention(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "customer-retention", params, tid],
    queryFn: () => api.analytics.customerRetention(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCartAbandonment(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "cart-abandonment", params, tid],
    queryFn: () => api.analytics.cartAbandonment(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useSalesReport(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "sales-report", params, tid],
    queryFn: () => api.analytics.salesReport(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useProductsReport(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "products-report", params, tid],
    queryFn: () => api.analytics.productsReport(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCustomersReport(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "customers-report", params, tid],
    queryFn: () => api.analytics.customersReport(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useCartsReport(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "carts-report", params, tid],
    queryFn: () => api.analytics.cartsReport(params, { tenantId: tid }),
    enabled: !!tid,
  });
}

export function useLiveView(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useQuery({
    queryKey: ["analytics", "live-view", tid],
    queryFn: () => api.analytics.liveView({ tenantId: tid }),
    enabled: !!tid,
    refetchInterval: 30_000,
  });
}

export function useCustomReport(tenantId?: string | null) {
  const tid = tenantId ?? getTenantId();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.analytics.customReport(body, { tenantId: tid }),
  });
}
