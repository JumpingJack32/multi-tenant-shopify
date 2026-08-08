"use client";

import { useQuery } from "@tanstack/react-query";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  fetchAuditLogs,
  type AuditFilters,
} from "@/features/audit/api/audit-service";

export function useAuditLogs(filters: AuditFilters, page: number, pageSize = 50) {
  const { currentTenantId } = useTenantContext();
  return useQuery({
    queryKey: ["audit-logs", currentTenantId, filters, page, pageSize],
    queryFn: () => fetchAuditLogs(filters, page, pageSize, currentTenantId),
    enabled: !!currentTenantId,
  });
}
