import { useQuery } from "@tanstack/react-query";

import { fetchCustomers, fetchCustomer } from "../api/customers-service";

export function useCustomers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => fetchCustomers(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
  });
}
