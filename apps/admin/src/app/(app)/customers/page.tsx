"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Customer } from "@repo/tenant-orm/types";

import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { CustomerDrawer } from "@/components/customers/customer-drawer";
import { CustomersHeader } from "@/components/customers/customers-header";
import { CustomersTable } from "@/components/customers/customers-table";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { FilterPopover } from "@/components/customers/filter-popover";
import { ImportCustomerDialog } from "@/components/customers/import-customer-dialog";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useCustomerMetrics,
  useCustomers,
  useExportCsv,
} from "@/features/customers/hooks/use-customers";
import { api } from "@/lib/api/client";

function penceToDecimal(pence: string): string {
  const n = parseInt(pence, 10);
  return isNaN(n) ? "" : (n / 100).toFixed(2);
}

function decimalToPence(decimal: string): string {
  const n = parseFloat(decimal);
  return isNaN(n) || n <= 0 ? "" : String(Math.round(n * 100));
}

interface FilterState {
  status: string;
  location: string;
  min_spent: string;
  max_spent: string;
  tag: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const exportMutation = useExportCsv(currentTenantId);

  const [filters, setFilters] = useState<FilterState>({
    status: searchParams.get("status") ?? "",
    location: searchParams.get("location") ?? "",
    min_spent: penceToDecimal(searchParams.get("min_spent") ?? ""),
    max_spent: penceToDecimal(searchParams.get("max_spent") ?? ""),
    tag: searchParams.get("tag") ?? "",
  });

  useEffect(() => {
    const idFromUrl = searchParams.get("id");
    if (idFromUrl) setDrawerCustomerId(idFromUrl);
  }, [searchParams]);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: "20", per_page: "20" };
    if (search) p.search = search;
    if (sortBy !== "created_at" || sortOrder !== "desc") {
      p.sort_by = sortBy;
      p.sort_order = sortOrder;
    }
    if (filters.status && filters.status !== "all") p.status = filters.status;
    if (filters.location) p.location = filters.location;
    if (filters.tag) p.tag = filters.tag;
    const minSpentPence = decimalToPence(filters.min_spent);
    const maxSpentPence = decimalToPence(filters.max_spent);
    if (minSpentPence) p.min_spent = minSpentPence;
    if (maxSpentPence) p.max_spent = maxSpentPence;
    return p;
  }, [search, sortBy, sortOrder, filters]);

  const { data, isLoading, error, refetch } = useCustomers(
    params,
    currentTenantId,
  );
  const { data: metrics, isLoading: metricsLoading } =
    useCustomerMetrics(currentTenantId);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  const handleRowDoubleClick = useCallback(
    (customer: Customer) => {
      setDrawerCustomerId(customer.id);
      router.push(`/customers?id=${customer.id}`, { scroll: false });
    },
    [router],
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerCustomerId(null);
    router.push("/customers", { scroll: false });
  }, [router]);

  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setSelectedIds(new Set());
  }, []);

  const handleSaveSegment = useCallback(
    async (name: string, filterValues: FilterState) => {
      const payload: Record<string, string> = {};
      if (filterValues.status && filterValues.status !== "all")
        payload.status = filterValues.status;
      if (filterValues.location) payload.location = filterValues.location;
      if (filterValues.tag) payload.tag = filterValues.tag;
      const m = decimalToPence(filterValues.min_spent);
      const x = decimalToPence(filterValues.max_spent);
      if (m) payload.min_spent = m;
      if (x) payload.max_spent = x;

      await api.segments.create(
        { name, filters: payload },
        { tenantId: currentTenantId ?? undefined },
      );
    },
    [currentTenantId],
  );

  const handleExport = useCallback(async () => {
    const result = await exportMutation.mutateAsync(params);
    const url = window.URL.createObjectURL(result);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [exportMutation, params]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">
          View and manage magazine subscribers
        </p>
      </div>

      <CustomersHeader
        metrics={metrics}
        isLoading={metricsLoading || tenantLoading}
        onAddCustomer={() => setAddDialogOpen(true)}
        onImportCsv={() => setImportDialogOpen(true)}
        onExportCsv={handleExport}
      />

      <div className="flex items-center justify-between">
        <CustomersToolbar
          search={search}
          onSearchChange={handleSearchChange}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onToggleSortOrder={handleToggleSortOrder}
        />
        <FilterPopover
          initial={filters}
          onApply={handleApplyFilters}
          onSaveSegment={handleSaveSegment}
        />
      </div>

      <CustomersTable
        data={data}
        isLoading={isLoading || tenantLoading}
        error={error as Error | null}
        onRefetch={refetch}
        onRowDoubleClick={handleRowDoubleClick}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <CustomerDrawer
        customerId={drawerCustomerId}
        open={!!drawerCustomerId}
        onOpenChange={(open) => {
          if (!open) handleDrawerClose();
        }}
        tenantId={currentTenantId}
      />

      <AddCustomerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        tenantId={currentTenantId}
      />

      <ImportCustomerDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        tenantId={currentTenantId}
      />
    </div>
  );
}
