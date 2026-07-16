import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerDetail, CustomerMetrics } from "@repo/tenant-orm/types";

import {
  addCustomerCredit,
  addCustomerTimelineEvent,
  createCustomer,
  deleteCustomer,
  exportCustomersCsv,
  fetchCustomer,
  fetchCustomerCredit,
  fetchCustomerMetrics,
  fetchCustomers,
  fetchCustomerTimeline,
  importCustomersCsv,
  updateCustomer,
} from "../api/customers-service";

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}

export function useCustomers(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery({
    queryKey: ["customers", params, tid],
    queryFn: () => fetchCustomers(params, tid),
    enabled: !!tid,
  });
}

export function useCustomer(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery<CustomerDetail>({
    queryKey: ["customer", id, tid],
    queryFn: () => fetchCustomer(id, tid),
    enabled: !!id && !!tid,
  });
}

export function useCustomerMetrics(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery<CustomerMetrics>({
    queryKey: ["customer-metrics", tid],
    queryFn: () => fetchCustomerMetrics(tid),
    enabled: !!tid,
  });
}

export function useCreateCustomer(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createCustomer(data, tid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-metrics"] });
    },
  });
}

export function useUpdateCustomer(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateCustomer(id, data, tid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
  });
}

export function useDeleteCustomer(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id, tid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-metrics"] });
    },
  });
}

export function useCustomerTimeline(
  customerId: string,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery({
    queryKey: ["customer-timeline", customerId, tid],
    queryFn: () => fetchCustomerTimeline(customerId, tid),
    enabled: !!customerId && !!tid,
  });
}

export function useAddTimelineEvent(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: Record<string, unknown>;
    }) => addCustomerTimelineEvent(customerId, data, tid),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer-timeline", variables.customerId],
      });
    },
  });
}

export function useCustomerCredit(
  customerId: string,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();

  return useQuery({
    queryKey: ["customer-credit", customerId, tid],
    queryFn: () => fetchCustomerCredit(customerId, tid),
    enabled: !!customerId && !!tid,
  });
}

export function useExportCsv(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();

  return useMutation({
    mutationFn: (params?: Record<string, string>) =>
      exportCustomersCsv(params, tid),
  });
}

export function useImportCsv(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importCustomersCsv(file, tid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-metrics"] });
    },
  });
}

export function useAddCredit(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: Record<string, unknown>;
    }) => addCustomerCredit(customerId, data, tid),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer-credit", variables.customerId],
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
