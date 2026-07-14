"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { InventoryItem } from "@repo/tenant-orm/types";
import { Button } from "@repo/ui/components/ui/button";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import { InventoryDialog } from "@/features/inventory/components/inventory-dialog";
import { InventoryFilters } from "@/features/inventory/components/inventory-filters";
import { InventoryStatsCards } from "@/features/inventory/components/inventory-stats";
import { InventoryTable } from "@/features/inventory/components/inventory-table";
import {
  useInventoryItems,
  useInventoryStats,
  useDeleteInventoryItem,
} from "@/features/inventory/hooks/use-inventory";

export default function InventoryPage() {
  const { can } = useRbac();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const itemsQuery = useInventoryItems(
    {
      q: search || undefined,
      category: category || undefined,
      status: status || undefined,
      page: String(page),
      page_size: String(pageSize),
    },
    currentTenantId,
  );

  const statsQuery = useInventoryStats(currentTenantId);
  const deleteMutation = useDeleteInventoryItem(currentTenantId);

  const items = itemsQuery.data?.data ?? [];
  const total = itemsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Item deleted");
        setDeletingId(null);
      },
      onError: () => {
        toast.error("Failed to delete item");
        setDeletingId(null);
      },
    });
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingItem(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Manage stock across all warehouses
          </p>
        </div>
        {can("update") && (
          <Button
            onClick={() => {
              setEditingItem(null);
              setDialogOpen(true);
            }}
          >
            Add Item
          </Button>
        )}
      </div>

      <InventoryStatsCards
        stats={statsQuery.data}
        loading={statsQuery.isPending || tenantLoading}
      />

      <InventoryFilters
        search={search}
        category={category}
        status={status}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onCategory={(v) => {
          setCategory(v);
          setPage(1);
        }}
        onStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      {itemsQuery.isError && (
        <ErrorBanner
          message={
            itemsQuery.error instanceof Error
              ? itemsQuery.error.message
              : "Failed to load inventory"
          }
          onRetry={() => itemsQuery.refetch()}
        />
      )}

      <InventoryTable
        items={items}
        loading={itemsQuery.isPending || tenantLoading}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(item: InventoryItem) => {
          setEditingItem(item);
          setDialogOpen(true);
        }}
        onDelete={handleDelete}
        deletingId={deletingId}
        setDeletingId={setDeletingId}
        canDelete={can("delete")}
      />

      <InventoryDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        item={editingItem}
        tenantId={currentTenantId}
      />
    </div>
  );
}
